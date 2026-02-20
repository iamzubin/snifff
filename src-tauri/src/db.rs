use rusqlite::{Connection, params};
use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpConnection {
    pub ip: String,
    pub asn: Option<String>,
    pub as_name: Option<String>,
    pub as_domain: Option<String>,
    pub country_code: Option<String>,
    pub country: Option<String>,
    pub continent_code: Option<String>,
    pub continent: Option<String>,
    pub hit_count: u64,
    pub first_seen: String,
    pub last_seen: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CountryStats {
    pub country_code: String,
    pub country: String,
    pub hit_count: u64,
    pub unique_ips: u64,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self, String> {
        let db_path = Self::get_db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create db directory: {}", e))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        // Create tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS connections (
                ip TEXT PRIMARY KEY,
                asn TEXT,
                as_name TEXT,
                as_domain TEXT,
                country_code TEXT,
                country TEXT,
                continent_code TEXT,
                continent TEXT,
                hit_count INTEGER DEFAULT 1,
                first_seen TEXT NOT NULL,
                last_seen TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_country_code ON connections(country_code);
            CREATE INDEX IF NOT EXISTS idx_last_seen ON connections(last_seen);
            "
        ).map_err(|e| format!("Failed to create tables: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    fn get_db_path() -> Result<PathBuf, String> {
        let home = std::env::var("HOME")
            .map_err(|_| "HOME not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library/Application Support/com.snifff.app")
            .join("snifff.db"))
    }

    /// Upsert a connection — insert or increment hit_count
    pub fn upsert_connection(&self, ip: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO connections (ip, hit_count, first_seen, last_seen)
             VALUES (?1, 1, ?2, ?2)
             ON CONFLICT(ip) DO UPDATE SET
                hit_count = hit_count + 1,
                last_seen = ?2",
            params![ip, now],
        ).map_err(|e| format!("Failed to upsert connection: {}", e))?;

        Ok(())
    }

    /// Update geo info for an IP
    pub fn update_geo_info(
        &self,
        ip: &str,
        asn: Option<&str>,
        as_name: Option<&str>,
        as_domain: Option<&str>,
        country_code: Option<&str>,
        country: Option<&str>,
        continent_code: Option<&str>,
        continent: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE connections SET
                asn = ?2,
                as_name = ?3,
                as_domain = ?4,
                country_code = ?5,
                country = ?6,
                continent_code = ?7,
                continent = ?8
             WHERE ip = ?1",
            params![ip, asn, as_name, as_domain, country_code, country, continent_code, continent],
        ).map_err(|e| format!("Failed to update geo info: {}", e))?;

        Ok(())
    }

    /// Get all connections ordered by last_seen
    pub fn get_connections(&self, limit: usize) -> Result<Vec<IpConnection>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT ip, asn, as_name, as_domain, country_code, country,
                    continent_code, continent, hit_count, first_seen, last_seen
             FROM connections
             ORDER BY last_seen DESC
             LIMIT ?1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(IpConnection {
                ip: row.get(0)?,
                asn: row.get(1)?,
                as_name: row.get(2)?,
                as_domain: row.get(3)?,
                country_code: row.get(4)?,
                country: row.get(5)?,
                continent_code: row.get(6)?,
                continent: row.get(7)?,
                hit_count: row.get::<_, i64>(8)? as u64,
                first_seen: row.get(9)?,
                last_seen: row.get(10)?,
            })
        }).map_err(|e| format!("Failed to query connections: {}", e))?;

        let mut connections = Vec::new();
        for row in rows {
            connections.push(row.map_err(|e| format!("Row error: {}", e))?);
        }

        Ok(connections)
    }

    /// Get country statistics for the heatmap
    pub fn get_country_stats(&self) -> Result<Vec<CountryStats>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn.prepare(
            "SELECT country_code, country, SUM(hit_count) as total_hits, COUNT(DISTINCT ip) as unique_ips
             FROM connections
             WHERE country_code IS NOT NULL AND country_code != ''
             GROUP BY country_code
             ORDER BY total_hits DESC"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let rows = stmt.query_map([], |row| {
            Ok(CountryStats {
                country_code: row.get(0)?,
                country: row.get(1)?,
                hit_count: row.get::<_, i64>(2)? as u64,
                unique_ips: row.get::<_, i64>(3)? as u64,
            })
        }).map_err(|e| format!("Failed to query country stats: {}", e))?;

        let mut stats = Vec::new();
        for row in rows {
            stats.push(row.map_err(|e| format!("Row error: {}", e))?);
        }

        Ok(stats)
    }

    /// Get total stats
    pub fn get_total_stats(&self) -> Result<(u64, u64, u64), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let total_ips: i64 = conn.query_row(
            "SELECT COUNT(*) FROM connections", [], |row| row.get(0)
        ).map_err(|e| format!("Query error: {}", e))?;

        let total_hits: i64 = conn.query_row(
            "SELECT COALESCE(SUM(hit_count), 0) FROM connections", [], |row| row.get(0)
        ).map_err(|e| format!("Query error: {}", e))?;

        let total_countries: i64 = conn.query_row(
            "SELECT COUNT(DISTINCT country_code) FROM connections WHERE country_code IS NOT NULL AND country_code != ''",
            [], |row| row.get(0)
        ).map_err(|e| format!("Query error: {}", e))?;

        Ok((total_ips as u64, total_hits as u64, total_countries as u64))
    }

    /// Check if an IP has geo info already
    pub fn has_geo_info(&self, ip: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM connections WHERE ip = ?1 AND country_code IS NOT NULL AND country_code != ''",
            params![ip],
            |row| row.get(0),
        ).map_err(|e| format!("Query error: {}", e))?;

        Ok(count > 0)
    }
}
