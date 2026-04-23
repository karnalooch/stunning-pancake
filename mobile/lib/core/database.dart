import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  Database? _database;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'sport_offline.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        // Table for raw GPS points (buffer)
        await db.execute('''
          CREATE TABLE gps_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id TEXT,
            latitude REAL,
            longitude REAL,
            altitude REAL,
            timestamp INTEGER,
            is_synced INTEGER DEFAULT 0
          )
        ''');
        
        // Table for offline activity metadata
        await db.execute('''
          CREATE TABLE activities (
            id TEXT PRIMARY KEY,
            type TEXT,
            start_time INTEGER,
            is_finished INTEGER DEFAULT 0
          )
        ''');
      },
    );
  }
}
