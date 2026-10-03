import test from 'node:test';
import assert from 'node:assert/strict';
import { dependsOnMissingVisual, visibleEscapes } from './questionQuality.js';

test('picture-dependent wording is blocked before a question reaches a child', () => {
  assert.equal(dependsOnMissingVisual('Look at this picture of a garden. What insect do you see?'), true);
  assert.equal(dependsOnMissingVisual('Which picture shows the cat with a ball?'), true);
  assert.equal(dependsOnMissingVisual('Here is a garden: 🌷 🐝 🌼. Name a bug you can find.'), false);
  assert.equal(dependsOnMissingVisual('You have a picture to color and your crayons are broken. What can you do?'), false);
});

test('visible escaped layout characters are rejected without rejecting real line breaks', () => {
  assert.equal(visibleEscapes('Pick one.\\n🍎 🍌'), true);
  assert.equal(visibleEscapes('Pick one.\n🍎 🍌'), false);
});
