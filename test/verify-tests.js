// Page Tag
const tag = 'whisk-management:verify-tests';

// Requirements
const assert = require('assert');
const { verify } = require('../lib/verify/verify')(tag);

describe('Verification Tests', () => {
  describe('Verify strings', () => {
    it('returns false for non-string or non-number items', async () => {
      assert.ok(verify(null, 'string') === false);
      assert.ok(verify(undefined, 'string') === false);
      assert.ok(verify(true, 'string') === false);
      assert.ok(verify(() => { return 'Hello'; }, 'string') === false);
      assert.ok(verify(546346, 'string'));
      assert.ok(verify(5654.6736, 'string'));
      assert.ok(verify(-764.839, 'string'));
      assert.ok(verify('Heres a string \^to test"\'', 'string'));
    });

    it('returns false for non-string types', async () => {
      assert.ok(verify('Valid Name', 'name'));
      assert.ok(verify('Valid Name', null) === false);
      assert.ok(verify('Valid Name', undefined) === false);
      assert.ok(verify('Valid Name', true) === false);
      assert.ok(verify('Valid Name', 354) === false);
    });

    it('returns false for empty input', async () => {
      assert.ok(verify('', 'name') === false);
    });

    it('returns false for name with bad characters', async () => {
      assert.ok(verify('John Doe 1', 'name') === false);
      assert.ok(verify('(Stephen)', 'name') === false);
      assert.ok(verify(12367, 'name') === false);
      assert.ok(verify('S+B', 'name') === false);
    });

    it('returns true for valid name', async () => {
      assert.ok(verify('Åsa Bergström', 'name'));
      assert.ok(verify('Stephen with wÉéird NÄmöå', 'name'));
      assert.ok(verify('SB Fernley-Whittingstall', 'name'));
    });

    it('returns false for number with bad characters', async () => {
      assert.ok(verify('John Doe 1', 'number') === false);
      assert.ok(verify('(Stephen)', 'number') === false);
      assert.ok(verify('S+B', 'number') === false);
      assert.ok(verify('12356789O2', 'number') === false);
    });

    it('returns true for valid number', async () => {
      assert.ok(verify(164783.8768, 'number'));
      assert.ok(verify('-785.45', 'number'));
      assert.ok(verify(-785, 'number'));
      assert.ok(verify(0, 'number'));
    });

    it('returns false for badly formatted email', async () => {
      assert.ok(verify('person@gmailcom', 'email') === false);
      assert.ok(verify('stebunting@e_mail.com', 'email') === false);
      assert.ok(verify('s.b.e.c.g@gc', 'email') === false);
      assert.ok(verify('ste+bunting@fyra@g%e.com', 'email') === false);
    });

    it('returns true for well formatted email', async () => {
      assert.ok(verify('stebunting@gmail.com', 'email'));
      assert.ok(verify('heres@ema1L.with.multiple.domains.com', 'email'));
      assert.ok(verify('jkl!@£$%^&*hujd@gma1l.com', 'email'));
      assert.ok(verify('this@that.se', 'email'));
    });
  });
});
