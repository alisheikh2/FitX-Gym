// In-memory data store for demo mode.
// Provides buildModel() which mimics the subset of Mongoose model API used by our routes.
import crypto from 'crypto';

const uid = () => crypto.randomBytes(12).toString('hex');

export const db = { users: [], plans: [], members: [], payments: [], attendances: [] };
let seeded = false;

export function seedDefaults() {
  if (seeded) return;
  seeded = true;
  if (db.users.length === 0) {
    db.users.push({ _id: uid(), username: 'owner', password: 'fitx2026', name: 'Zohaib Ali', role: 'owner', createdAt: new Date(), updatedAt: new Date() });
    db.users.push({ _id: uid(), username: 'staff', password: 'staff2026', name: 'Front Desk', role: 'staff', createdAt: new Date(), updatedAt: new Date() });
  }
  if (db.plans.length === 0) {
    [
      { name: 'Day Pass', description: 'Single-day gym access', durationDays: 1, price: 500, category: 'gym', includesPT: false },
      { name: 'Monthly Gym Access', description: 'Full gym access, no personal training', durationDays: 30, price: 3500, category: 'gym', includesPT: false },
      { name: 'Quarterly Gym Access', description: '3 months gym access', durationDays: 90, price: 9000, category: 'gym', includesPT: false },
      { name: 'Monthly PT Package', description: 'Gym access + one-on-one personal training', durationDays: 30, price: 12000, category: 'pt', includesPT: true },
      { name: 'Quarterly PT Package', description: '3 months personal training package', durationDays: 90, price: 32000, category: 'pt', includesPT: true },
      { name: "Women's Monthly PT", description: "Women-only coaching with Iqra Zahid", durationDays: 30, price: 10000, category: 'female', includesPT: true },
      { name: 'Student Monthly', description: 'Discounted monthly access for students', durationDays: 30, price: 2500, category: 'student', includesPT: false },
      { name: 'Couple Monthly', description: 'Two memberships at a discounted rate', durationDays: 30, price: 6000, category: 'couple', includesPT: false },
    ].forEach(p => db.plans.push({ _id: uid(), active: true, createdAt: new Date(), updatedAt: new Date(), ...p }));
  }
}

function stripMethods(o) {
  const out = {};
  for (const k of Object.keys(o)) {
    if (typeof o[k] !== 'function') out[k] = o[k];
  }
  return out;
}

function matchOp(actual, q) {
  if (q === undefined || q === null) return true;
  if (q instanceof RegExp) return q.test(String(actual || ''));
  if (typeof q === 'object') {
    if ('$regex' in q) return new RegExp(q.$regex, q.$options || '').test(String(actual || ''));
    if ('$gte' in q && new Date(actual) < new Date(q.$gte)) return false;
    if ('$lte' in q && new Date(actual) > new Date(q.$lte)) return false;
    if ('$gt' in q && new Date(actual) <= new Date(q.$gt)) return false;
    if ('$lt' in q && new Date(actual) >= new Date(q.$lt)) return false;
    if ('$ne' in q && actual === q.$ne) return false;
    if ('$in' in q && !q.$in.includes(actual)) return false;
    return true;
  }
  return actual === q;
}

function applyQuery(arr, query) {
  let r = arr.slice();
  for (const [k, q] of Object.entries(query)) {
    if (k === '$or' && Array.isArray(q)) {
      r = r.filter(row => q.some(cond => Object.entries(cond).every(([ck, cv]) => matchOp(row[ck], cv))));
    } else if (k === '$and' && Array.isArray(q)) {
      for (const sub of q) r = applyQuery(r, sub);
    } else {
      r = r.filter(row => matchOp(row[k], q));
    }
  }
  return r;
}

export function buildModel(store, name) {
  class Model {
    constructor(data) {
      Object.assign(this, { _id: uid(), createdAt: new Date(), updatedAt: new Date(), ...data });
    }
    async save() {
      this.updatedAt = new Date();
      const plain = stripMethods(this);
      const i = store.findIndex(x => x._id === this._id);
      if (i >= 0) store[i] = plain; else store.push(plain);
      Object.assign(this, plain);
      return this;
    }

    static async create(data) {
      // For User, store password as-is (bcrypt pre-save won't run in memory mode)
      // matchPassword is attached on retrieval
      const d = { _id: uid(), createdAt: new Date(), updatedAt: new Date(), ...data };
      store.push(d);
      return d;
    }

    static find(query = {}, opts = {}) {
      let _q = query;
      let _sort = null;
      let _limit = 0;
      let _skip = 0;
      function execute() {
        let r = applyQuery(store, _q).map(d => name === 'User' ? { ...d, matchPassword: async (pw) => pw === d.password } : { ...d });
        if (_sort) {
          const k = Object.keys(_sort)[0];
          const dir = _sort[k];
          r.sort((a, b) => {
            const av = a[k], bv = b[k];
            if (av instanceof Date || bv instanceof Date) return dir * (new Date(bv) - new Date(av));
            if (typeof av === 'string' && !isNaN(Date.parse(av)) && av.length >= 8) return dir * (new Date(bv) - new Date(av));
            return dir * ((bv||0) - (av||0));
          });
        }
        if (_skip) r = r.slice(_skip);
        if (_limit) r = r.slice(0, _limit);
        return r;
      }
      const chain = {
        sort(spec) { _sort = spec; return chain; },
        limit(n) { _limit = n; return chain; },
        skip(n) { _skip = n; return chain; },
        select() { return chain; },
        populate() { return chain; },
        lean() { return chain; },
        then(resolve, reject) {
          try { return Promise.resolve(execute()).then(resolve, reject); }
          catch (e) { return Promise.reject(e).catch(reject); }
        },
        catch(reject) { return Promise.resolve(execute()).catch(reject); },
        [Symbol.asyncIterator]() { const arr = execute(); let i = 0; return { next: () => Promise.resolve({ value: arr[i++], done: i > arr.length }) }; },
      };
      return chain;
    }

    static async findOne(query) {
      const r = await this.find(query);
      return r[0] || null;
    }

    static async findById(id) {
      const d = store.find(x => x._id === id) || null;
      if (d && name === 'User') d.matchPassword = async (pw) => pw === d.password;
      return d;
    }

    static async findByIdAndUpdate(id, update) {
      const i = store.findIndex(x => x._id === id);
      if (i < 0) return null;
      store[i] = { ...store[i], ...update, updatedAt: new Date() };
      return store[i];
    }

    static async findByIdAndDelete(id) {
      const i = store.findIndex(x => x._id === id);
      if (i < 0) return null;
      return store.splice(i, 1)[0];
    }

    static async countDocuments(query = {}) {
      return (await this.find(query)).length;
    }

    static async insertMany(docs) {
      return Promise.all(docs.map(d => this.create(d)));
    }

    static async aggregate(stages = []) {
      let data = store.slice();
      let grouped = null;
      for (const st of stages) {
        if (st.$match) data = applyQuery(data, st.$match);
        else if (st.$group) {
          const g = {};
          data.forEach(d => {
            let key;
            if (st.$group._id === null) key = '__all';
            else if (typeof st.$group._id === 'string') key = d[st.$group._id.replace('$','')] ?? '';
            else key = d[Object.values(st.$group._id)[0].replace('$','')] ?? '';
            if (!g[key]) g[key] = { _id: key };
            for (const [f, op] of Object.entries(st.$group)) {
              if (f === '_id') continue;
              if (op.$sum) {
                const field = op.$sum === 1 ? '__c' : op.$sum.replace('$','');
                g[key][f] = (g[key][f] || 0) + (field === '__c' ? 1 : (Number(d[field]) || 0));
              }
            }
          });
          grouped = Object.values(g);
        } else if (st.$sort) {
          const k = Object.keys(st.$sort)[0];
          const dir = st.$sort[k];
          data.sort((a,b) => dir * ((b[k]||0) - (a[k]||0)));
        }
      }
      return grouped || data;
    }

    static schema = { pre: () => {}, index: () => {}, paths: {} };
    static index() {}
  }
  return Model;
}
