import sys,os
root=sys.argv[1]
def r(p,a,b):
    p=os.path.join(root,p); s=open(p).read(); assert s.count(a)==1,(p,a); open(p,'w').write(s.replace(a,b))
# Never show "Invalid Date" if the account's creation date is missing.
r('src/components/AppMenu.tsx',"  const memberSince = new Date(accountCreatedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });",
  "  const created = new Date(accountCreatedAt);\n  const memberSince = Number.isNaN(created.getTime()) ? '—' : created.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });")
# Test data: a real-looking account creation date.
r('e2e/screens/support.ts',"last_sign_in_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString() } }));",
  "last_sign_in_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString(), created_at: '2026-09-01T10:00:00Z' } }));")
print('ok')
