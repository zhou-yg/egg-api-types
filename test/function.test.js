const {analyze} = require('../lib/analyze/index');
const {loadCode} = require('./utils');

let mockAst;

beforeEach(() => {
  mockAst = loadCode();
});

test('simple', () => {
  let r = analyze(mockAst.function.simple);
  expect(r).toStrictEqual([1])
});


test('this', () => {
  let r = analyze(mockAst.function.this);
  expect(r).toStrictEqual([2])
});

test('class', () => {
  let r = analyze(mockAst.function.class);
  expect(r).toStrictEqual(['class'])
});
