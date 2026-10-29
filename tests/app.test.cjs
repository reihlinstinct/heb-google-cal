const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../docs/index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '../docs/app.js'), 'utf8');
function fixture() {
  const elements = new Map();
  const calls = {logs: [], auth: [], inserts: [], deletes: []};
  function element(id) {
    if (!elements.has(id)) elements.set(id, {style: {}, options: [{value: 'synthetic-calendar'}], selectedIndex: 0,
      appendChild(x) { this.options.push(x); }, innerHTML: ''});
    return elements.get(id);
  }
  const context = {console: {log: (...x) => calls.logs.push(x.join(' '))}, document: {
    getElementById: element, createElement: () => ({}), createTextNode: x => x},
    Hebcal: {HDate: class {constructor() {this.year = 5787;} }},
    gapi: {load: () => {}, client: {getToken: () => ({access_token: 'SYNTHETIC_TOKEN_SENTINEL'}),
      setToken: token => calls.auth.push(token), calendar: {events: {
        insert: x => calls.inserts.push(x), delete: x => calls.deletes.push(x)}}}},
    google: {accounts: {oauth2: {initTokenClient: config => {
      const client = {requestAccessToken: args => calls.auth.push(args)};
      calls.client = client; calls.config = config; return client;},
      revoke: (token, callback) => {calls.auth.push(token); callback();}}}}};
  for (const id of ['calendar_select','fromYear_select','toYear_select','fromYear_p','toYear_p','delete_button','duplicate_button','duplicate_p']) context[id] = element(id);
  vm.createContext(context); vm.runInContext(source, context, {filename: 'app.js'});
  return {context, calls, elements};
}
test('HTML loads application before async auth callbacks, with no inline app code', () => {
  assert.ok(html.includes('<script src="app.js"></script>'));
  assert.ok(html.indexOf('src="app.js"') < html.indexOf('src="https://apis.google.com/js/api.js"'));
  assert.ok(html.indexOf('src="app.js"') < html.indexOf('src="https://accounts.google.com/gsi/client"'));
  assert.ok(!/<script(?:\s[^>]*)?>(?!\s*<\/script>)[\s\S]*?<\/script>/.test(html.replace(/<script\b[^>]*\bsrc=[^>]*><\/script>/g, '')));
});
test('initial load defines callbacks without calendar writes or auth requests', () => {
  const {context, calls} = fixture();
  assert.equal(typeof context.gapiLoad, 'function'); assert.equal(typeof context.gisInit, 'function');
  assert.deepEqual(calls.inserts, []); assert.deepEqual(calls.deletes, []); assert.deepEqual(calls.auth, []);
});
test('authorization callback never logs token data', () => {
  const {context, calls} = fixture();
  context.gisInit(); context.updateSigninStatus = x => calls.signedIn = x;
  context.showEvents(); calls.client.callback({});
  assert.equal(calls.signedIn, true);
  assert.ok(calls.logs.join(' ').includes('authorization completed'));
  assert.ok(!calls.logs.join(' ').includes('SYNTHETIC_TOKEN_SENTINEL'));
});
test('revocation never logs token data and preserves behavior', () => {
  const {context, calls} = fixture(); context.updateSigninStatus = x => calls.signedIn = x;
  context.revokeToken(); assert.equal(calls.signedIn, false);
  assert.equal(calls.auth[0], 'SYNTHETIC_TOKEN_SENTINEL'); assert.equal(calls.auth[1], '');
  assert.ok(!calls.logs.join(' ').includes('SYNTHETIC_TOKEN_SENTINEL'));
});
test('basic event selection helpers preserve behavior', () => {
  const {context} = fixture(); assert.equal(context.getStartOfEvent({date: '2026-10-29'}), '2026-10-29');
  assert.equal(context.getStartOfEvent({dateTime: 'synthetic-date-time'}), 'synthetic-date-time');
  assert.equal(context.getSelectedValue({options: [{value: 'mock'}], selectedIndex: 0}), 'mock');
});
