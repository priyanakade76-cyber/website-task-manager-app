const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = process.env.SUPABASE_URL || 'https://zdxuppyzbmokskyyvnek.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkeHVwcHl6Ym1va3NreXl2bmVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTM2MzI2NywiZXhwIjoyMTA2OTM5MjY3fQ.eAJjGpNC0An0nvk3RapiOb1uFLjKSEoFgfz44X4LDrA';

const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.trim() !== '' &&
  supabaseKey.trim() !== '' &&
  !supabaseUrl.includes('your-project') &&
  !supabaseKey.includes('your-supabase')
);

let supabase = null;

if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log(`[Supabase] Client initialized successfully for ${supabaseUrl}`);
  } catch (err) {
    console.error(`[Supabase] Failed to initialize official client:`, err.message);
  }
}

// In-Memory Fallback Adapter for offline development/testing
// Enables complete project execution before user pastes live Supabase credentials
class MemoryQueryBuilder {
  constructor(table, memoryStore) {
    this.table = table;
    this.memoryStore = memoryStore;
    this.filters = [];
    this.sortField = null;
    this.sortAsc = true;
    this.limitCount = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.isCountOnly = false;
    this.action = 'select'; // 'select', 'insert', 'update', 'delete'
    this.payload = null;
  }

  select(columns = '*', options = {}) {
    if (options && options.count === 'exact' && options.head) {
      this.isCountOnly = true;
    }
    return this;
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column, value) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  gt(column, value) {
    const valTime = new Date(value).getTime();
    this.filters.push((row) => {
      if (!row[column]) return false;
      return new Date(row[column]).getTime() > valTime;
    });
    return this;
  }

  gte(column, value) {
    const valTime = new Date(value).getTime();
    this.filters.push((row) => {
      if (!row[column]) return false;
      return new Date(row[column]).getTime() >= valTime;
    });
    return this;
  }

  lt(column, value) {
    const valTime = new Date(value).getTime();
    this.filters.push((row) => {
      if (!row[column]) return false;
      return new Date(row[column]).getTime() < valTime;
    });
    return this;
  }

  lte(column, value) {
    const valTime = new Date(value).getTime();
    this.filters.push((row) => {
      if (!row[column]) return false;
      return new Date(row[column]).getTime() <= valTime;
    });
    return this;
  }

  ilike(column, pattern) {
    const cleanPattern = pattern.replace(/^%/, '').replace(/%$/, '').toLowerCase();
    this.filters.push((row) => {
      const val = (row[column] || '').toString().toLowerCase();
      return val.includes(cleanPattern);
    });
    return this;
  }

  or(conditionsStr) {
    // Basic support for title.ilike.%search%,description.ilike.%search%
    const parts = conditionsStr.split(',');
    this.filters.push((row) => {
      return parts.some((p) => {
        const [col, op, pattern] = p.split('.');
        const clean = (pattern || '').replace(/^%/, '').replace(/%$/, '').toLowerCase();
        const val = (row[col] || '').toString().toLowerCase();
        return val.includes(clean);
      });
    });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.sortField = column;
    this.sortAsc = ascending;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  insert(data) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  update(data) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  async then(resolve, reject) {
    try {
      const res = await this.execute();
      resolve(res);
    } catch (err) {
      reject(err);
    }
  }

  async execute() {
    const store = this.memoryStore.getTable(this.table);

    if (this.action === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = items.map((item) => {
        const id = item.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const row = {
          ...item,
          id,
          created_at: item.created_at || now,
          updated_at: item.updated_at || now
        };
        store.push(row);
        return row;
      });

      const data = Array.isArray(this.payload) ? inserted : inserted[0];
      return { data, error: null };
    }

    if (this.action === 'update') {
      const updated = [];
      const now = new Date().toISOString();
      for (let i = 0; i < store.length; i++) {
        const row = store[i];
        const match = this.filters.every((f) => f(row));
        if (match) {
          const newRow = {
            ...row,
            ...this.payload,
            updated_at: now
          };
          store[i] = newRow;
          updated.push(newRow);
        }
      }

      if (this.isSingle) {
        if (updated.length === 0) {
          return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
        }
        return { data: updated[0], error: null };
      }
      if (this.isMaybeSingle) {
        return { data: updated.length > 0 ? updated[0] : null, error: null };
      }
      return { data: updated, error: null };
    }

    if (this.action === 'delete') {
      const remaining = [];
      const deleted = [];
      for (const row of store) {
        const match = this.filters.every((f) => f(row));
        if (match) {
          deleted.push(row);
        } else {
          remaining.push(row);
        }
      }
      this.memoryStore.setTable(this.table, remaining);
      return { data: deleted, error: null };
    }

    // Default: 'select'
    let results = store.filter((row) => this.filters.every((f) => f(row)));

    if (this.isCountOnly) {
      return { count: results.length, data: null, error: null };
    }

    if (this.sortField) {
      results.sort((a, b) => {
        let valA = a[this.sortField];
        let valB = b[this.sortField];
        if (valA === undefined || valA === null) return this.sortAsc ? 1 : -1;
        if (valB === undefined || valB === null) return this.sortAsc ? -1 : 1;
        if (typeof valA === 'string' && !isNaN(Date.parse(valA))) {
          valA = new Date(valA).getTime();
          valB = new Date(valB).getTime();
        }
        if (valA < valB) return this.sortAsc ? -1 : 1;
        if (valA > valB) return this.sortAsc ? 1 : -1;
        return 0;
      });
    }

    if (this.limitCount !== null) {
      results = results.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      if (results.length === 0) {
        return { data: null, error: { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: results[0], error: null };
    }

    if (this.isMaybeSingle) {
      return { data: results.length > 0 ? results[0] : null, error: null };
    }

    return { data: results, count: results.length, error: null };
  }
}

class MemoryStore {
  constructor() {
    this.tables = {
      users: [],
      categories: [],
      tasks: [],
      task_notes: [],
      activities: [],
      notifications: []
    };
  }

  getTable(name) {
    if (!this.tables[name]) {
      this.tables[name] = [];
    }
    return this.tables[name];
  }

  setTable(name, data) {
    this.tables[name] = data;
  }

  from(tableName) {
    return new MemoryQueryBuilder(tableName, this);
  }
}

const memoryStoreInstance = new MemoryStore();

// Export active client: real Supabase if credentials provided, otherwise Memory adapter
const activeClient = isConfigured && supabase ? supabase : memoryStoreInstance;

const checkSupabaseConnection = async () => {
  if (isConfigured && supabase) {
    try {
      const { error } = await supabase.from('users').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        console.warn(`[Supabase] Remote check warning: ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`[Supabase] Remote PostgreSQL connected & verified successfully!`);
      }
      return true;
    } catch (e) {
      console.warn(`[Supabase] Remote check error: ${e.message}`);
      return false;
    }
  } else {
    console.log(`[Supabase] Running with in-memory adapter fallback.`);
    console.log(`[Supabase] To connect to your live project, set SUPABASE_URL and SUPABASE_KEY in .env and run supabase-schema.sql`);
    return true;
  }
};

module.exports = {
  supabase: activeClient,
  checkSupabaseConnection,
  isConfigured
};
