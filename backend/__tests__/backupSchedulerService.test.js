const mockExecFile = jest.fn((cmd, args, opts, callback) => callback(null, { stdout: '', stderr: '' }));

jest.mock('child_process', () => ({ execFile: (...args) => mockExecFile(...args) }));
// Only stub mkdirSync — spreading the real module keeps every other fs method
// (notably fs.write/fs.open, which pino's stdout destination needs internally)
// intact. A full fs replacement here previously broke logger calls made from
// inside runScheduledBackup() whenever this file's sandbox was the first to
// initialize pino's destination stream, an order-dependent full-suite-only
// failure unrelated to whatever this test is actually meant to check.
jest.mock('fs', () => ({ ...jest.requireActual('fs'), mkdirSync: jest.fn() }));

const { runScheduledBackup, startBackupScheduler, isEnabled } = require('../src/services/backupSchedulerService');

describe('backupSchedulerService', () => {
  const originalEnabled = process.env.ENABLE_SCHEDULED_BACKUPS;
  const originalMongoUri = process.env.MONGO_URI;
  const originalBackupDir = process.env.BACKUP_DIR;

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.ENABLE_SCHEDULED_BACKUPS;
    else process.env.ENABLE_SCHEDULED_BACKUPS = originalEnabled;
    if (originalMongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalMongoUri;
    if (originalBackupDir === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = originalBackupDir;
    jest.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('is false by default', () => {
      delete process.env.ENABLE_SCHEDULED_BACKUPS;
      expect(isEnabled()).toBe(false);
    });

    it('is true only when explicitly set to "true"', () => {
      process.env.ENABLE_SCHEDULED_BACKUPS = 'true';
      expect(isEnabled()).toBe(true);
      process.env.ENABLE_SCHEDULED_BACKUPS = 'yes';
      expect(isEnabled()).toBe(false);
    });
  });

  describe('runScheduledBackup', () => {
    it('does not run mongodump when disabled', async () => {
      delete process.env.ENABLE_SCHEDULED_BACKUPS;

      const result = await runScheduledBackup();

      expect(result.ran).toBe(false);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it('does not run when enabled but MONGO_URI is unset', async () => {
      process.env.ENABLE_SCHEDULED_BACKUPS = 'true';
      delete process.env.MONGO_URI;

      const result = await runScheduledBackup();

      expect(result.ran).toBe(false);
      expect(result.reason).toMatch(/MONGO_URI/);
    });

    it('invokes mongodump with the configured URI and archive path when enabled', async () => {
      process.env.ENABLE_SCHEDULED_BACKUPS = 'true';
      process.env.MONGO_URI = 'mongodb://localhost:27017/metabsp';
      process.env.BACKUP_DIR = '/tmp/backups';

      const result = await runScheduledBackup();

      expect(mockExecFile).toHaveBeenCalledWith(
        'mongodump',
        expect.arrayContaining([
          'mongodb://localhost:27017/metabsp'.replace(/^/, '--uri='),
          expect.stringMatching(/^--archive=\/tmp\/backups\/metabsp-.*\.gz$/),
          '--gzip',
        ]),
        expect.objectContaining({ timeout: expect.any(Number) }),
        expect.any(Function)
      );
      expect(result.ran).toBe(true);
      expect(result.archivePath).toMatch(/^\/tmp\/backups\/metabsp-.*\.gz$/);
    });

    it('reports (not throws) when mongodump itself fails', async () => {
      process.env.ENABLE_SCHEDULED_BACKUPS = 'true';
      process.env.MONGO_URI = 'mongodb://localhost:27017/metabsp';
      mockExecFile.mockImplementationOnce((cmd, args, opts, callback) => callback(new Error('mongodump not found')));

      const result = await runScheduledBackup();

      expect(result.ran).toBe(true);
      expect(result.error).toMatch(/mongodump not found/);
    });
  });

  describe('startBackupScheduler', () => {
    it('returns null and schedules nothing when disabled', () => {
      delete process.env.ENABLE_SCHEDULED_BACKUPS;

      const handle = startBackupScheduler();

      expect(handle).toBeNull();
    });

    it('returns an unref-ed interval handle when enabled', () => {
      process.env.ENABLE_SCHEDULED_BACKUPS = 'true';
      process.env.MONGO_URI = 'mongodb://localhost:27017/metabsp';

      const handle = startBackupScheduler({ intervalMs: 3600000 });

      expect(handle).not.toBeNull();
      clearInterval(handle);
    });
  });
});
