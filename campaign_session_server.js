const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CAMPAIGNS_DIR = path.join(DATA_DIR, 'campaigns');

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(PUBLIC_DIR));

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createId() {
  return crypto.randomUUID();
}

function sanitizeName(name) {
  return String(name || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\.+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function campaignSlug(name) {
  return sanitizeName(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `campaign-${Date.now()}`;
}

function sessionFileName(name) {
  const safe = sanitizeName(name);
  return `${safe || todayString()}.json`;
}

function campaignDir(slug) {
  return path.join(CAMPAIGNS_DIR, path.basename(slug));
}

function campaignMetaPath(slug) {
  return path.join(campaignDir(slug), '_campaign.json');
}

function sessionPath(slug, fileName) {
  return path.join(campaignDir(slug), 'sessions', path.basename(fileName));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  // Atomic write: write to temp file then rename
  const tempPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

async function initStorage() {
  await ensureDir(CAMPAIGNS_DIR);
}

async function listCampaignSlugs() {
  const entries = await fs.readdir(CAMPAIGNS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function readCampaign(slug) {
  return readJson(campaignMetaPath(slug));
}

async function readSession(slug, fileName) {
  return readJson(sessionPath(slug, fileName));
}

async function listSessions(slug) {
  const sessionsDir = path.join(campaignDir(slug), 'sessions');
  await ensureDir(sessionsDir);

  const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

  const sessionPromises = files.map(async (file) => {
    const data = await readSession(slug, file);
    return {
      id: data.id,
      name: data.name,
      fileName: file,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      completed: Boolean(data.completed),
    };
  });

  return Promise.all(sessionPromises);
}

async function listCampaignsDetailed() {
  const slugs = await listCampaignSlugs();

  const campaignPromises = slugs.map(async (slug) => {
    const meta = await readCampaign(slug);
    const sessions = await listSessions(slug);
    return {
      slug,
      name: meta.name,
      completed: Boolean(meta.completed),
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      sessionCount: sessions.length,
    };
  });

  const result = await Promise.all(campaignPromises);
  return result.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
}

async function ensureUniqueCampaignSlug(baseSlug) {
  let slug = baseSlug;
  let counter = 2;
  while (await exists(campaignDir(slug))) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
}

async function ensureUniqueSessionFile(slug, desiredName, ignoreFileName = null) {
  const parsed = path.parse(sessionFileName(desiredName));
  let fileName = `${parsed.name}${parsed.ext || '.json'}`;
  let counter = 2;

  while (true) {
    const fullPath = sessionPath(slug, fileName);
    const taken = await exists(fullPath);
    if (!taken || fileName === ignoreFileName) {
      return fileName;
    }
    fileName = `${parsed.name}-${counter}.json`;
    counter += 1;
  }
}

function makeDefaultSessionData(name) {
  return {
    id: createId(),
    name: sanitizeName(name) || todayString(),
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: {},
  };
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/campaigns', async (_req, res, next) => {
  try {
    const campaigns = await listCampaignsDetailed();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

app.post('/api/campaigns', async (req, res, next) => {
  try {
    const name = sanitizeName(req.body?.name);
    if (!name) {
      return res.status(400).json({ error: 'Назва кампанії обов’язкова.' });
    }

    const slug = await ensureUniqueCampaignSlug(campaignSlug(name));
    const now = new Date().toISOString();
    const meta = {
      id: createId(),
      slug,
      name,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    await ensureDir(path.join(campaignDir(slug), 'sessions'));
    await writeJson(campaignMetaPath(slug), meta);

    res.status(201).json(meta);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/campaigns/:slug', async (req, res, next) => {
  try {
    const oldSlug = req.params.slug;
    const metaPath = campaignMetaPath(oldSlug);
    if (!(await exists(metaPath))) {
      return res.status(404).json({ error: 'Кампанію не знайдено.' });
    }

    const current = await readCampaign(oldSlug);
    const nextName = req.body?.name ? sanitizeName(req.body.name) : current.name;
    const completed =
      typeof req.body?.completed === 'boolean' ? req.body.completed : current.completed;

    if (!nextName) {
      return res.status(400).json({ error: 'Назва кампанії не може бути порожньою.' });
    }

    let nextSlug = oldSlug;
    if (nextName !== current.name) {
      nextSlug = await ensureUniqueCampaignSlug(campaignSlug(nextName));
      if (nextSlug !== oldSlug) {
        await fs.rename(campaignDir(oldSlug), campaignDir(nextSlug));
      }
    }

    const updated = {
      ...current,
      slug: nextSlug,
      name: nextName,
      completed,
      updatedAt: new Date().toISOString(),
    };

    await writeJson(campaignMetaPath(nextSlug), updated);
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/campaigns/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    const dir = campaignDir(slug);
    if (!(await exists(dir))) {
      return res.status(404).json({ error: 'Кампанію не знайдено.' });
    }

    await fs.rm(dir, { recursive: true, force: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/api/campaigns/:slug/sessions', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!(await exists(campaignMetaPath(slug)))) {
      return res.status(404).json({ error: 'Кампанію не знайдено.' });
    }

    const sessions = await listSessions(slug);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

app.post('/api/campaigns/:slug/sessions', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!(await exists(campaignMetaPath(slug)))) {
      return res.status(404).json({ error: 'Кампанію не знайдено.' });
    }

    const baseName = sanitizeName(req.body?.name) || todayString();
    const session = makeDefaultSessionData(baseName);
    const fileName = await ensureUniqueSessionFile(slug, session.name);

    if (req.body?.data && typeof req.body.data === 'object') {
      session.data = req.body.data;
    }

    await writeJson(sessionPath(slug, fileName), session);

    res.status(201).json({
      id: session.id,
      name: session.name,
      fileName,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completed: session.completed,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/campaigns/:slug/sessions/:fileName', async (req, res, next) => {
  try {
    const { slug, fileName } = req.params;
    const fullPath = sessionPath(slug, fileName);
    if (!(await exists(fullPath))) {
      return res.status(404).json({ error: 'Сесію не знайдено.' });
    }

    const session = await readJson(fullPath);
    res.json({ ...session, fileName });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/campaigns/:slug/sessions/:fileName', async (req, res, next) => {
  try {
    const { slug, fileName } = req.params;
    const fullPath = sessionPath(slug, fileName);
    if (!(await exists(fullPath))) {
      return res.status(404).json({ error: 'Сесію не знайдено.' });
    }

    const current = await readJson(fullPath);
    const nextName = req.body?.name ? sanitizeName(req.body.name) : current.name;
    const nextCompleted =
      typeof req.body?.completed === 'boolean' ? req.body.completed : current.completed;
    const nextData =
      req.body?.data && typeof req.body.data === 'object' ? req.body.data : current.data;

    if (!nextName) {
      return res.status(400).json({ error: 'Назва сесії не може бути порожньою.' });
    }

    const nextFileName = await ensureUniqueSessionFile(slug, nextName, fileName);
    const updated = {
      ...current,
      name: nextName,
      completed: nextCompleted,
      updatedAt: new Date().toISOString(),
      data: nextData,
    };

    if (nextFileName !== fileName) {
      await fs.rename(fullPath, sessionPath(slug, nextFileName));
    }

    await writeJson(sessionPath(slug, nextFileName), updated);

    res.json({
      ...updated,
      fileName: nextFileName,
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/campaigns/:slug/sessions/:fileName', async (req, res, next) => {
  try {
    const { slug, fileName } = req.params;
    const fullPath = sessionPath(slug, fileName);
    if (!(await exists(fullPath))) {
      return res.status(404).json({ error: 'Сесію не знайдено.' });
    }

    await fs.rm(fullPath, { force: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Внутрішня помилка сервера.' });
});

initStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Campaign data directory: ${CAMPAIGNS_DIR}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize storage:', error);
    process.exit(1);
  });