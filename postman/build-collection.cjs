#!/usr/bin/env node
/**
 * Builds the KidCog Postman collection from the server's own code.
 *
 *   node postman/build-collection.cjs
 *
 * The category list is read from server/src/traits.ts, so adding or renaming a
 * category never leaves the collection out of date — just run this again.
 * If you add or change an endpoint in server/src/index.ts, update the matching
 * request below and re-run.
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const root = path.join(__dirname, '..');
const ts = require(path.join(root, 'server/node_modules/typescript'));
const vm = require('vm');

// ---- read the categories straight from the server ----
const traitsSrc = fs.readFileSync(path.join(root, 'server/src/traits.ts'), 'utf8');
const traitsMod = {};
vm.runInNewContext(
  ts.transpileModule(traitsSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports: traitsMod, require },
);
const TRAITS = traitsMod.TRAIT_ORDER.map((key) => ({
  key, label: traitsMod.TRAITS[key].label, group: traitsMod.TRAITS[key].group ?? 'intellectual',
}));
const GROUPS = {
  intellectual: 'Intellectual Ability',
  social_emotional: 'Social/Emotional/Behavioral',
  verbal_linguistic: 'Academic Skills: Verbal/Linguistic',
  logical_mathematical: 'Academic Skills: Logical/Mathematical',
};
for (const t of TRAITS) if (!GROUPS[t.group]) throw new Error(`Unknown group "${t.group}" on ${t.key}: add it to GROUPS`);

// ---- helpers ----
const url = (p) => {
  const [pathPart, query] = p.split('?');
  return {
    raw: '{{baseUrl}}' + p, host: ['{{baseUrl}}'], path: pathPart.split('/').filter(Boolean),
    ...(query ? { query: query.split('&').map((kv) => { const [key, value] = kv.split('='); return { key, value }; }) } : {}),
  };
};
const raw = (text) => ({ mode: 'raw', raw: text, options: { raw: { language: 'json' } } });
const jsonHeader = [{ key: 'Content-Type', value: 'application/json' }];
const events = ({ pre, test }) => [
  ...(pre ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: pre } }] : []),
  ...(test ? [{ listen: 'test', script: { type: 'text/javascript', exec: test } }] : []),
];
const skipUnless = (varName, why) => [
  `if (!pm.collectionVariables.get('${varName}')) {`,
  `  console.log('Skipped: ${why}');`,
  '  pm.execution.skipRequest();',
  '}',
];
const parse = "let j; try { j = pm.response.json(); } catch (e) { j = { error: pm.response.text().slice(0, 200) }; }";
const failLine = "pm.test(`FAILED — HTTP ${pm.response.code}: ${j.error || ''}${j.detail ? ' — ' + j.detail : ''}`, () => { throw new Error(j.detail || j.error || 'failed'); });";

// Checks every generated round the same way: right count, only the two
// question types the server produces, and nothing private leaked to the app.
const roundChecks = [
  // pm.variables resolves the same way {{count}} in the body does (environment
  // before collection), so the check always matches what was actually asked for.
  "const want = Number(pm.variables.get('count'));",
  'const secs = Math.round(pm.response.responseTime / 1000);',
  "const types = j.questions.map(q => q.type).join(', ');",
  'pm.test(`OK in ${secs}s — ${j.questions.length} questions: ${types}`, () => pm.expect(j.questions.length).to.eql(want));',
  "pm.test('Only spoken (open) and multiple-choice (mcq) questions', () => {",
  "  for (const q of j.questions) {",
  "    pm.expect(['open', 'mcq']).to.include(q.type);",
  "    if (q.type === 'mcq') pm.expect(q.options, 'mcq needs options').to.be.an('array').with.length.within(2, 4);",
  "    else pm.expect(q.options, 'open has no options').to.eql(null);",
  '  }',
  '});',
  "pm.test('No answer keys or rubrics sent to the app', () => {",
  "  for (const q of j.questions) { pm.expect(q).to.not.have.property('answerKey'); pm.expect(q).to.not.have.property('rubric'); }",
  '});',
  "j.questions.forEach((q, i) => console.log(`${pm.info.requestName} Q${i + 1} [${q.type}] ${q.prompt}`));",
];

// ---- 0. setup ----
const setup = {
  name: '0. Setup — run these first',
  item: [
    {
      name: 'Health check',
      request: { method: 'GET', auth: { type: 'noauth' }, url: url('/health') },
      event: events({ test: [
        parse,
        'pm.test(`Server up — AI ready: ${j.aiReady}, model: ${j.model}`, () => pm.expect(j.aiReady).to.eql(true));',
        "if (j.keyProblem) console.log('Key problem: ' + j.keyProblem);",
        // Fresh run: forget anything a previous run left in variables.
        "for (const v of ['roundSessionId', 'flowSessionId', 'flowQuestions', 'speechBase64']) pm.collectionVariables.unset(v);",
      ] }),
    },
    {
      name: 'Sign in (email + password) → saves token',
      request: {
        method: 'POST', auth: { type: 'noauth' },
        header: [{ key: 'apikey', value: '{{supabaseAnonKey}}' }, ...jsonHeader],
        body: raw('{\n  "email": "{{email}}",\n  "password": "{{password}}"\n}'),
        url: { raw: '{{supabaseUrl}}/auth/v1/token?grant_type=password', host: ['{{supabaseUrl}}'], path: ['auth', 'v1', 'token'], query: [{ key: 'grant_type', value: 'password' }] },
        description: 'Signs in with Supabase and stores the access token. Google-only accounts have no password: paste a token into the `token` environment variable and skip this request (it skips itself when email is blank).',
      },
      event: events({
        pre: ["if (!pm.environment.get('email')) { console.log('Skipped: no email set — using the token already in the environment.'); pm.execution.skipRequest(); }"],
        test: [
          parse,
          "if (j.access_token) { pm.environment.set('token', j.access_token); pm.test('Signed in — token saved (valid about an hour)', () => true); }",
          "else pm.test('Sign-in failed: ' + (j.error_description || j.msg || j.error || pm.response.code), () => { throw new Error('no token'); });",
        ],
      }),
    },
    {
      name: 'List children → picks the first child',
      request: { method: 'GET', url: url('/api/children') },
      event: events({ test: [
        parse,
        "if (!Array.isArray(j)) { pm.test('Could not list children: ' + (j.error || pm.response.code), () => { throw new Error(j.error); }); return; }",
        "if (j.length === 0) { pm.test('No child profiles yet — the next request creates one', () => true); return; }",
        "pm.environment.set('childId', j[0].id);",
        "pm.environment.set('age', String(j[0].age));",
        'pm.test(`Using ${j[0].nickname}, age ${j[0].age} (${j.length} profile(s))`, () => true);',
      ] }),
    },
    {
      name: 'Create test child (only when you have none)',
      request: { method: 'POST', header: jsonHeader, body: raw('{\n  "nickname": "Postman test",\n  "age": 5\n}'), url: url('/api/children') },
      event: events({
        pre: [
          '// A full run reaches this request every time. Without this guard each',
          '// run would add another profile to your real database.',
          "if (pm.environment.get('childId')) { console.log('Skipped: a child profile is already selected.'); pm.execution.skipRequest(); }",
        ],
        test: [
          parse,
          "if (pm.response.code === 201 && j.id) {",
          "  pm.environment.set('childId', j.id); pm.environment.set('age', String(j.age));",
          "  pm.collectionVariables.set('createdChildId', j.id);",
          "  pm.test('Created test child ' + j.id, () => true);",
          `} else { ${failLine} }`,
        ],
      }),
    },
    {
      name: 'List categories',
      request: { method: 'GET', url: url('/api/categories') },
      event: events({ test: [
        parse,
        `pm.test(\`\${Array.isArray(j) ? j.length : 0} categories returned (collection built for ${TRAITS.length})\`, () => pm.expect(j).to.be.an('array').with.lengthOf(${TRAITS.length}));`,
      ] }),
    },
  ],
};

// ---- 1–4. one AI round per category, all in one test session ----
const categoryFolders = Object.entries(GROUPS).map(([group, label], i) => ({
  name: `${i + 1}. ${label}`,
  item: TRAITS.filter((t) => t.group === group).map((t) => ({
    name: `${t.key} — ${t.label}`,
    request: {
      method: 'POST', header: jsonHeader, url: url('/api/test'),
      // Built as text so age and count go in as numbers; sessionId is filled
      // by the pre-request script so every category shares one session.
      body: raw(`{\n  "childProfileId": "{{childId}}",\n  "sessionId": null,\n  "age": {{age}},\n  "trait": "${t.key}",\n  "count": {{count}},\n  "requestId": "{{$guid}}",\n  "exclude": []\n}`),
    },
    event: events({
      pre: [
        '// Reuse the session the first category created, so a full run adds one',
        '// session to your account instead of one per category. Cleanup deletes it.',
        'const body = JSON.parse(pm.request.body.raw.replace(/{{age}}/g, "0").replace(/{{count}}/g, "0"));',
        "body.sessionId = pm.collectionVariables.get('roundSessionId') || null;",
        "pm.request.body.update(JSON.stringify(body, null, 2).replace('\"age\": 0', '\"age\": {{age}}').replace('\"count\": 0', '\"count\": {{count}}'));",
      ],
      test: [
        parse,
        'if (pm.response.code === 200 && Array.isArray(j.questions)) {',
        "  if (j.sessionId && !pm.collectionVariables.get('roundSessionId')) pm.collectionVariables.set('roundSessionId', j.sessionId);",
        ...roundChecks.map((l) => '  ' + l),
        `} else { ${failLine} }`,
      ],
    }),
  })),
}));

// ---- 5. a complete session, end to end ----
const flow = {
  name: '5. Full session flow — generate, answer, history, report',
  item: [
    {
      name: 'Generate a round (flowTrait)',
      request: { method: 'POST', header: jsonHeader, url: url('/api/test'),
        body: raw('{\n  "childProfileId": "{{childId}}",\n  "sessionId": null,\n  "age": {{age}},\n  "trait": "{{flowTrait}}",\n  "count": {{count}},\n  "requestId": "{{$guid}}",\n  "exclude": []\n}') },
      event: events({ test: [
        parse,
        'if (pm.response.code === 200 && Array.isArray(j.questions)) {',
        "  pm.collectionVariables.set('flowSessionId', j.sessionId);",
        "  pm.collectionVariables.set('flowQuestions', JSON.stringify(j.questions.map(q => ({ id: q.id, type: q.type, options: q.options }))));",
        ...roundChecks.map((l) => '  ' + l),
        `} else { ${failLine} }`,
      ] }),
    },
    {
      name: 'Submit answers → scored report',
      request: { method: 'POST', header: jsonHeader, url: url('/api/submit'),
        body: raw('{\n  "sessionId": "{{flowSessionId}}",\n  "responses": "filled in by the pre-request script from the round above"\n}') },
      event: events({
        pre: [
          ...skipUnless('flowSessionId', 'the round above did not generate.'),
          '// Answers the questions that were actually generated: the first choice',
          '// for multiple choice, a short sensible sentence for spoken questions.',
          "const qs = JSON.parse(pm.collectionVariables.get('flowQuestions') || '[]');",
          'pm.request.body.update(JSON.stringify({',
          "  sessionId: pm.collectionVariables.get('flowSessionId'),",
          "  child: { firstName: 'Test', age: Number(pm.environment.get('age')) },",
          "  responses: qs.map(q => ({ questionId: q.id, answer: q.type === 'mcq' ? q.options[0].key : 'I would ask what is wrong and try to help, because that makes people feel better.', elapsedSeconds: 12 })),",
          '}, null, 2));',
        ],
        test: [
          parse,
          'if (pm.response.code === 200 && j.overall) {',
          "  const qs = JSON.parse(pm.collectionVariables.get('flowQuestions') || '[]');",
          '  pm.test(`Scored: ${j.overall.earned} of ${j.overall.possible} points (${j.overall.percent}%)`, () => pm.expect(j.responses).to.have.lengthOf(qs.length));',
          "  pm.test(j.parentReport ? 'Written parent report generated' : 'Parent report failed (scores still saved): ' + (j.parentReportError || 'unknown'), () => pm.expect(j.parentReport).to.be.an('object'));",
          `} else { ${failLine} }`,
        ],
      }),
    },
    {
      name: 'Assessment history for the child',
      request: { method: 'GET', url: url('/api/children/{{childId}}/sessions?limit=20&offset=0') },
      event: events({ test: [
        parse,
        'if (pm.response.code === 200 && Array.isArray(j.sessions)) {',
        "  const id = pm.collectionVariables.get('flowSessionId');",
        '  pm.test(`${j.sessions.length} completed session(s) listed`, () => true);',
        "  if (id) pm.test('The session just completed is in the history', () => pm.expect(j.sessions.map(s => s.id)).to.include(id));",
        `} else { ${failLine} }`,
      ] }),
    },
    {
      name: 'Report for the completed session',
      request: { method: 'GET', url: url('/api/sessions/{{flowSessionId}}/report') },
      event: events({
        pre: skipUnless('flowSessionId', 'no completed session to read.'),
        test: [parse, `if (pm.response.code === 200) pm.test('Report loaded', () => pm.expect(j).to.be.an('object')); else { ${failLine} }`],
      }),
    },
  ],
};

// ---- 6. voice ----
const voice = {
  name: '6. Voice — speech and transcription',
  item: [
    {
      name: 'Speak a sentence (no sign-in needed)',
      request: { method: 'GET', auth: { type: 'noauth' }, url: url('/api/speak?text=The%20cat%20sat%20on%20the%20mat.') },
      event: events({ test: [
        "const type = pm.response.headers.get('Content-Type') || '';",
        "if (pm.response.code === 200 && type.startsWith('audio/')) {",
        '  pm.test(`Audio returned: ${type}, ${pm.response.responseSize} bytes`, () => pm.expect(pm.response.responseSize).to.be.above(100));',
        "  // Kept so the next request can transcribe real speech.",
        "  pm.collectionVariables.set('speechBase64', pm.response.stream.toString('base64'));",
        `} else { ${parse} ${failLine} }`,
      ] }),
    },
    {
      name: 'Transcribe that audio back to text',
      request: { method: 'POST', header: jsonHeader, url: url('/api/transcribe'),
        body: raw('{\n  "audioBase64": "{{speechBase64}}",\n  "filename": "speech.mp3",\n  "mimeType": "audio/mpeg"\n}') },
      event: events({
        pre: skipUnless('speechBase64', 'no audio from the speak request.'),
        test: [
          parse,
          "if (pm.response.code === 200 && typeof j.text === 'string') pm.test(`Heard: \"${j.text}\"`, () => pm.expect(j.text.toLowerCase()).to.include('cat'));",
          `else { ${failLine} }`,
        ],
      }),
    },
  ],
};

// ---- 7. error handling — no AI calls, nothing spent ----
const expectError = (name, method, p, body, status, message, noAuth) => ({
  name, request: { method, ...(noAuth ? { auth: { type: 'noauth' } } : {}), ...(body ? { header: jsonHeader, body: raw(body) } : {}), url: url(p) },
  event: events({ test: [parse, `pm.test('Rejected with ${status}: ' + (j.error || ''), () => { pm.expect(pm.response.code).to.eql(${status}); pm.expect(j.error).to.include(${JSON.stringify(message)}); });`] }),
});
const errors = {
  name: '7. Error handling — should be rejected (no AI cost)',
  item: [
    expectError('No sign-in → 401', 'GET', '/api/children', null, 401, 'sign in', true),
    expectError('Round with 3 questions → 400 (only 2, 5 or 6)', 'POST', '/api/test', '{\n  "childProfileId": "{{childId}}",\n  "age": {{age}},\n  "trait": "humor",\n  "count": 3,\n  "requestId": "{{$guid}}"\n}', 400, '2, 5, or 6'),
    expectError('Unknown category → 400', 'POST', '/api/test', '{\n  "childProfileId": "{{childId}}",\n  "age": {{age}},\n  "trait": "not_a_category",\n  "count": 2,\n  "requestId": "{{$guid}}"\n}', 400, 'category'),
    expectError('Child that is not yours → 404', 'POST', '/api/test', '{\n  "childProfileId": "00000000-0000-4000-8000-000000000000",\n  "age": 5,\n  "trait": "humor",\n  "count": 2,\n  "requestId": "{{$guid}}"\n}', 404, 'not found'),
    expectError('Age 13 → 400', 'POST', '/api/children', '{\n  "nickname": "Too old",\n  "age": 13\n}', 400, 'nickname'),
    expectError('Speak with no text → 400', 'GET', '/api/speak?text=', null, 400, 'text is required', true),
    expectError('Report for a bad session id → 400', 'GET', '/api/sessions/not-a-uuid/report', null, 400, 'Invalid assessment session'),
  ],
};

// ---- 8. cleanup — deletes only what this run created ----
const cleanup = {
  name: '8. Cleanup — removes only what this run created',
  item: [
    {
      name: 'Delete the category-round session',
      request: { method: 'DELETE', url: url('/api/sessions/{{roundSessionId}}') },
      event: events({ pre: skipUnless('roundSessionId', 'no category session was created.'),
        test: [`if (pm.response.code === 204) { pm.test('Deleted', () => true); pm.collectionVariables.unset('roundSessionId'); } else { ${parse} ${failLine} }`] }),
    },
    {
      name: 'Delete the full-flow session',
      request: { method: 'DELETE', url: url('/api/sessions/{{flowSessionId}}') },
      event: events({ pre: skipUnless('flowSessionId', 'no flow session was created.'),
        test: [`if (pm.response.code === 204) { pm.test('Deleted', () => true); pm.collectionVariables.unset('flowSessionId'); } else { ${parse} ${failLine} }`] }),
    },
    {
      name: 'Delete the test child (only if this collection created it AND allowDeleteTestChild = yes)',
      request: { method: 'DELETE', url: url('/api/children/{{createdChildId}}') },
      event: events({
        pre: [
          '// Deleting a child also deletes its history, so this never runs by accident:',
          "// it needs a child this collection created and an explicit opt-in.",
          "if (!pm.collectionVariables.get('createdChildId') || pm.variables.get('allowDeleteTestChild') !== 'yes') {",
          "  console.log('Skipped: set allowDeleteTestChild to yes to remove the test child this collection created.');",
          '  pm.execution.skipRequest();',
          '}',
        ],
        test: [`if (pm.response.code === 204) { pm.test('Deleted test child', () => true); pm.collectionVariables.unset('createdChildId'); pm.environment.unset('childId'); } else { ${parse} ${failLine} }`],
      }),
    },
  ],
};

const collection = {
  info: {
    _postman_id: '6f1c2c0e-8a53-4c62-9d1e-0c4b1f7a2e10',
    name: 'KidCog API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description: [
      `Every KidCog API endpoint: all ${TRAITS.length} categories, a complete session, voice, and error handling. Built from the server code by \`postman/build-collection.cjs\` — re-run it after changing categories or endpoints.`,
      '',
      '**Setup (once):** import both files, select the **KidCog Local** environment, and fill in `supabaseUrl` and `supabaseAnonKey` (the values of `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `app/.env`), `email` and `password`. Set Settings → Request timeout to 0.',
      '',
      '**Run:** start the server (`npm run dev` in `server/`), then right-click the collection → Run. Each request reports OK, or FAILED with the server\'s exact reason. Generated questions appear in the Postman Console.',
      '',
      '**What a full run leaves behind:** nothing. It creates one session for the category rounds and one for the full flow, and Cleanup deletes both. If you have no child profile it creates "Postman test"; set `allowDeleteTestChild` to `yes` to have Cleanup remove it too.',
      '',
      '**Pacing:** the server allows 30 requests a minute, so the collection spaces requests about 2 seconds apart. Avoid using the app while a run is going: it shares the same limit.',
      '',
      '**Settings (collection variables):** `count` is questions per round (2, 5 or 6; 2 is quickest and cheapest). `flowTrait` is the category used for the full session flow.',
      '',
      '**Google-only account?** It has no password. Leave `email` blank, open the web app → DevTools → Network → any `children` request → Authorization header, copy everything after `Bearer ` into `token`.',
      '',
      `**Cost:** each round is 3–5 OpenAI calls. A full run is ${TRAITS.length + 1} rounds plus grading, one speech and one transcription. Folder 7 costs nothing.`,
    ].join('\n'),
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'count', value: '2' },
    { key: 'flowTrait', value: 'sensitivity_others' },
    { key: 'allowDeleteTestChild', value: 'no' },
  ],
  item: [setup, ...categoryFolders, flow, voice, errors, cleanup],
  // The server allows 30 requests a minute per address (index.ts) and counts
  // refused requests too, so a fast run locks itself out with 429s. Space
  // requests at least 2.1s apart; slow AI rounds are never delayed further.
  event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: [
    "const gap = 2100, last = Number(pm.collectionVariables.get('lastRequestAt') || 0);",
    'const wait = Math.max(0, last + gap - Date.now());',
    "pm.collectionVariables.set('lastRequestAt', String(Date.now() + wait));",
    'if (wait > 0) setTimeout(() => {}, wait);',
  ] } }],
};

const environment = {
  id: 'b2d6f0a4-3c1e-4f8a-9e27-5a0d9c3e71b4',
  name: 'KidCog Local',
  _postman_variable_scope: 'environment',
  values: [
    { key: 'supabaseUrl', value: '', type: 'default', enabled: true },
    { key: 'supabaseAnonKey', value: '', type: 'default', enabled: true },
    { key: 'email', value: '', type: 'default', enabled: true },
    { key: 'password', value: '', type: 'secret', enabled: true },
    { key: 'token', value: '', type: 'secret', enabled: true },
  ],
};

fs.writeFileSync(path.join(__dirname, 'KidCog.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'KidCog-Local.postman_environment.json'), JSON.stringify(environment, null, 2) + '\n');
const count = (f) => f.item.length;
console.log(`KidCog.postman_collection.json: ${[setup, ...categoryFolders, flow, voice, errors, cleanup].reduce((n, f) => n + count(f), 0)} requests`);
for (const f of [setup, ...categoryFolders, flow, voice, errors, cleanup]) console.log(`  ${f.name}: ${count(f)}`);
