/**
 * Database module for browser control service
 * Using better-sqlite3 for synchronous, high-performance SQLite operations
 */

const BetterSqlite3 = require('better-sqlite3');
const Logger = require('./logger');
const path = require('path');

class Database {
  constructor(dbName = 'browser_data.db') {
    this.dbName = dbName;
    this.db = null;
    this.checkpointInterval = null;
  }

  /**
   * Initialize database connection
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      // better-sqlite3 is synchronous, but we wrap in async for API compatibility
      this.db = new BetterSqlite3(this.dbName, {
        verbose: Logger.debug.bind(Logger)
      });
      
      Logger.info(`Connected to database: ${this.dbName}`);
      await this.configureDatabase();
    } catch (err) {
      Logger.error(`Database connection error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Configure database performance parameters
   * @returns {Promise<void>}
   */
  async configureDatabase() {
    try {
      // Enable WAL mode
      this.db.pragma('journal_mode = WAL');
      Logger.info('WAL mode enabled');

      // Set sync mode to NORMAL (balance performance and safety)
      this.db.pragma('synchronous = NORMAL');
      
      // Set cache size (in pages, default page size 4KB, setting to 20MB here)
      this.db.pragma('cache_size = -20000');
      
      // Set temp storage to memory
      this.db.pragma('temp_store = MEMORY');
      
      // Set mmap size (256MB)
      this.db.pragma('mmap_size = 268435456');
      
      // Enable foreign key constraints
      this.db.pragma('foreign_keys = ON');
      
      // Set busy timeout (5 seconds)
      this.db.pragma('busy_timeout = 5000');
      
      // Set WAL auto checkpoint (every 1000 pages)
      this.db.pragma('wal_autocheckpoint = 1000');

      Logger.info('Database performance configuration complete');
      
      // Start periodic checkpoint (every 30 minutes)
      this.startPeriodicCheckpoint();
    } catch (err) {
      Logger.error(`Database configuration error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Start periodic WAL checkpoint
   * @param {number} intervalMinutes Checkpoint interval (minutes)
   */
  startPeriodicCheckpoint(intervalMinutes = 30) {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
    
    this.checkpointInterval = setInterval(async () => {
      try {
        await this.checkpoint('PASSIVE');
        Logger.info('Periodic WAL checkpoint completed');
      } catch (err) {
        Logger.error(`Periodic WAL checkpoint error: ${err.message}`);
      }
    }, intervalMinutes * 60 * 1000);
    
    Logger.info(`Started periodic WAL checkpoint, interval: ${intervalMinutes} minutes`);
  }

  /**
   * Stop periodic WAL checkpoint
   */
  stopPeriodicCheckpoint() {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
      this.checkpointInterval = null;
      Logger.info('Stopped periodic WAL checkpoint');
    }
  }

  /**
   * Initialize database table structure
   * @returns {Promise<void>}
   */
  async initDb() {
    if (!this.db) {
      await this.connect();
    }

    const queries = [
      // Create tabs table
      `CREATE TABLE IF NOT EXISTS tabs (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT FALSE,
        window_id TEXT,
        index_in_window INTEGER,
        favicon_url TEXT,
        status TEXT DEFAULT 'complete',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_status CHECK (status IN ('loading', 'complete', 'error')),
        CONSTRAINT valid_url CHECK (url != ''),
        CONSTRAINT unique_window_index UNIQUE (window_id, index_in_window)
      )`,

      // Create independent cookies table (not associated with tab_id)
      `CREATE TABLE IF NOT EXISTS cookies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        value TEXT,
        domain TEXT NOT NULL,
        path TEXT DEFAULT '/',
        secure BOOLEAN DEFAULT FALSE,
        http_only BOOLEAN DEFAULT FALSE,
        same_site TEXT DEFAULT 'no_restriction',
        expiration_date INTEGER,
        session BOOLEAN DEFAULT FALSE,
        store_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_same_site CHECK (same_site IN ('strict', 'lax', 'none', 'no_restriction', 'unspecified')),
        CONSTRAINT unique_cookie UNIQUE (name, domain, path)
      )`,

      // Create HTML content table
      `CREATE TABLE IF NOT EXISTS html_content (
        tab_id TEXT PRIMARY KEY,
        full_html TEXT,
        chunk_count INTEGER,
        received_chunks INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tab_id) REFERENCES tabs (id) ON DELETE CASCADE
      )`,

      // Create HTML chunks table
      `CREATE TABLE IF NOT EXISTS html_chunks (
        tab_id TEXT,
        chunk_index INTEGER,
        chunk_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tab_id, chunk_index),
        FOREIGN KEY (tab_id) REFERENCES html_content (tab_id) ON DELETE CASCADE
      )`,

      // Create callbacks table
      `CREATE TABLE IF NOT EXISTS callbacks (
        request_id TEXT PRIMARY KEY,
        callback_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (DATETIME(CURRENT_TIMESTAMP, '+1 hour'))
      )`,

      // Create callback responses table
      `CREATE TABLE IF NOT EXISTS callback_responses (
        request_id TEXT PRIMARY KEY,
        response_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create WebSocket clients table
      `CREATE TABLE IF NOT EXISTS websocket_clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT UNIQUE NOT NULL,
        address TEXT NOT NULL,
        client_type TEXT DEFAULT 'extension',
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disconnected_at TIMESTAMP
      )`,

      // Create indexes to improve query performance
      `CREATE INDEX IF NOT EXISTS idx_tabs_window ON tabs(window_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tabs_active ON tabs(is_active)`,
      `CREATE INDEX IF NOT EXISTS idx_callbacks_expires ON callbacks(expires_at)`,
      `CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain)`,
      `CREATE INDEX IF NOT EXISTS idx_cookies_name ON cookies(name)`
    ];

    // Triggers need to be created separately (better-sqlite3 doesn't support them in transactions well)
    const triggerQueries = [
      // Create trigger to auto-update html_content updated_at
      `CREATE TRIGGER IF NOT EXISTS update_html_content_timestamp 
       AFTER UPDATE ON html_content
       BEGIN
         UPDATE html_content SET updated_at = CURRENT_TIMESTAMP 
         WHERE tab_id = NEW.tab_id;
       END`,

      // Create trigger to auto-update tabs updated_at
      `CREATE TRIGGER IF NOT EXISTS update_tabs_timestamp 
       AFTER UPDATE ON tabs
       BEGIN
         UPDATE tabs SET updated_at = CURRENT_TIMESTAMP 
         WHERE id = NEW.id;
       END`,

      // Create trigger to auto-update cookies updated_at
      `CREATE TRIGGER IF NOT EXISTS update_cookies_timestamp 
       AFTER UPDATE ON cookies
       BEGIN
         UPDATE cookies SET updated_at = CURRENT_TIMESTAMP 
         WHERE id = NEW.id;
       END`
    ];

    try {
      await this.runTransaction(queries);
      
      // Create triggers outside transaction
      for (const trigger of triggerQueries) {
        try {
          this.db.exec(trigger);
        } catch (err) {
          // Ignore "trigger already exists" errors
          if (!err.message.includes('already exists')) {
            Logger.warn(`Trigger creation warning: ${err.message}`);
          }
        }
      }
      
      Logger.info('Database initialized successfully');
      
      // Check and create potentially missing tables (for backward compatibility)
      await this.checkAndCreateMissingTables();
    } catch (err) {
      Logger.error(`Database initialization error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Execute single SQL query
   * @param {string} query SQL query statement
   * @param {Array} params Query parameters
   * @returns {Promise<Object>} Query result
   */
  async run(query, params = []) {
    try {
      // Handle transaction control statements with exec() instead of prepare()
      const upperQuery = query.trim().toUpperCase();
      if (upperQuery === 'BEGIN TRANSACTION' || 
          upperQuery === 'BEGIN' ||
          upperQuery === 'COMMIT' || 
          upperQuery === 'ROLLBACK') {
        this.db.exec(query);
        return { lastID: null, changes: 0 };
      }
      
      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);
      
      // Convert lastInsertRowid to string to avoid int32 serialization issues
      const lastID = result.lastInsertRowid != null ? String(result.lastInsertRowid) : null;
      return { lastID, changes: result.changes };
    } catch (err) {
      Logger.error(`Database execute error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Execute query and get single row result
   * @param {string} query SQL query statement
   * @param {Array} params Query parameters
   * @returns {Promise<Object>} Query result
   */
  async get(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.get(...params);
    } catch (err) {
      Logger.error(`Database get error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Execute query and get all rows
   * @param {string} query SQL query statement
   * @param {Array} params Query parameters
   * @returns {Promise<Array>} Query result
   */
  async all(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      return stmt.all(...params);
    } catch (err) {
      Logger.error(`Database query error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Execute transaction
   * @param {Array<string>} queries Array of queries to execute
   * @param {Array<Array>} paramsArray Array of parameter arrays (optional)
   * @returns {Promise<void>}
   */
  async runTransaction(queries, paramsArray = []) {
    if (!queries || queries.length === 0) {
      return;
    }

    // better-sqlite3 transaction API
    const transaction = this.db.transaction(() => {
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const params = paramsArray[i] || [];
        
        try {
          const stmt = this.db.prepare(query);
          stmt.run(...params);
          Logger.debug(`Query ${i + 1}/${queries.length} executed successfully`);
        } catch (err) {
          Logger.error(`Query ${i + 1}/${queries.length} execution error: ${err.message}`, { query, params });
          throw err; // This will cause transaction rollback
        }
      }
    });

    try {
      transaction();
      Logger.debug(`Transaction completed successfully, executed ${queries.length} queries`);
    } catch (err) {
      Logger.error(`Transaction failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Manually execute WAL checkpoint
   * @param {string} mode Checkpoint mode: 'PASSIVE' (default), 'FULL', 'RESTART', 'TRUNCATE'
   * @returns {Promise<void>}
   */
  async checkpoint(mode = 'PASSIVE') {
    try {
      this.db.pragma(`wal_checkpoint(${mode})`);
      Logger.info(`WAL checkpoint completed (${mode} mode)`);
    } catch (err) {
      Logger.error(`WAL checkpoint execution error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get WAL mode status info
   * @returns {Promise<Object>} WAL status info
   */
  async getWalInfo() {
    try {
      const journalMode = this.db.pragma('journal_mode', { simple: true });
      const walInfo = this.db.pragma('wal_checkpoint');
      
      return {
        journalMode: journalMode || 'unknown',
        walInfo: walInfo || null
      };
    } catch (err) {
      Logger.error(`Get WAL info error: ${err.message}`);
      throw err;
    }
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      try {
        // Stop periodic checkpoint
        this.stopPeriodicCheckpoint();
        
        // Execute WAL checkpoint before closing to ensure all data is written to main database file
        try {
          this.db.pragma('wal_checkpoint(TRUNCATE)');
          Logger.info('WAL checkpoint completed');
        } catch (err) {
          Logger.warn(`WAL checkpoint warning: ${err.message}`);
        }
        
        // Close database connection
        this.db.close();
        Logger.info('Database connection closed');
        this.db = null;
      } catch (err) {
        Logger.error(`Close database error: ${err.message}`);
        throw err;
      }
    }
  }

  /**
   * Check and create missing tables (for database upgrade)
   * @returns {Promise<void>}
   */
  async checkAndCreateMissingTables() {
    try {
      // Check if cookies table exists
      const cookiesExists = await this.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='cookies'"
      );

      if (!cookiesExists) {
        Logger.info('Missing cookies table detected, creating...');
        
        const createCookiesQueries = [
          // Create independent cookies table
          `CREATE TABLE IF NOT EXISTS cookies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            value TEXT,
            domain TEXT NOT NULL,
            path TEXT DEFAULT '/',
            secure BOOLEAN DEFAULT FALSE,
            http_only BOOLEAN DEFAULT FALSE,
            same_site TEXT DEFAULT 'no_restriction',
            expiration_date INTEGER,
            session BOOLEAN DEFAULT FALSE,
            store_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT valid_same_site CHECK (same_site IN ('strict', 'lax', 'none', 'no_restriction', 'unspecified')),
            CONSTRAINT unique_cookie UNIQUE (name, domain, path)
          )`,

          // Create indexes
          `CREATE INDEX IF NOT EXISTS idx_cookies_domain ON cookies(domain)`,
          `CREATE INDEX IF NOT EXISTS idx_cookies_name ON cookies(name)`
        ];

        await this.runTransaction(createCookiesQueries);
        
        // Create trigger separately
        try {
          this.db.exec(`CREATE TRIGGER IF NOT EXISTS update_cookies_timestamp 
           AFTER UPDATE ON cookies
           BEGIN
             UPDATE cookies SET updated_at = CURRENT_TIMESTAMP 
             WHERE id = NEW.id;
           END`);
        } catch (err) {
          if (!err.message.includes('already exists')) {
            Logger.warn(`Trigger creation warning: ${err.message}`);
          }
        }
        
        Logger.info('Cookies table and related indexes/triggers created successfully');
      }

      // Handle data migration from tab_cookies to cookies
      await this.migrateCookiesTable();

      // Check if websocket_clients table has client_type column
      const tableInfo = this.db.pragma("table_info('websocket_clients')");
      const clientTypeColumnExists = tableInfo.some(col => col.name === 'client_type');

      if (!clientTypeColumnExists) {
        Logger.info('Detected websocket_clients table missing client_type column, adding...');
        this.db.exec(`ALTER TABLE websocket_clients ADD COLUMN client_type TEXT DEFAULT 'extension'`);
        Logger.info('client_type column added to websocket_clients table successfully');
      }

      Logger.info('Database table check completed');
    } catch (err) {
      Logger.error(`Error checking/creating missing tables: ${err.message}`);
      throw err;
    }
  }

  /**
   * Migrate cookies table structure (from tab_cookies to cookies)
   * @returns {Promise<void>}
   */
  async migrateCookiesTable() {
    try {
      // Check if old tab_cookies table exists
      const tabCookiesExists = await this.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='tab_cookies'"
      );

      if (tabCookiesExists) {
        Logger.info('Detected old tab_cookies table, starting data migration to cookies table...');
        
        // Check if cookies table exists
        const cookiesExists = await this.get(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='cookies'"
        );

        if (cookiesExists) {
          // Migrate data (remove tab_id field, keep other fields)
          const migrationQuery = `
            INSERT OR IGNORE INTO cookies (
              name, value, domain, path, secure, http_only, same_site, 
              expiration_date, session, store_id, created_at, updated_at
            )
            SELECT DISTINCT 
              name, value, domain, path, secure, http_only, same_site, 
              expiration_date, session, store_id, created_at, updated_at
            FROM tab_cookies
          `;
          
          await this.run(migrationQuery);
          
          // Get number of migrated records
          const result = await this.run('SELECT 1');
          Logger.info(`Cookie records migration completed`);
          
          // Delete old table
          this.db.exec('DROP TABLE tab_cookies');
          Logger.info('Old tab_cookies table deleted');
        }
      }
    } catch (err) {
      Logger.error(`Cookies table migration failed: ${err.message}`);
      // Don't throw error as this is not a fatal issue
    }
  }
}

module.exports = Database;
