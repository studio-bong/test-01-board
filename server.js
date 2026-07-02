const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const DB_PATH = path.join(__dirname, 'db.json');

// =========================
// Middleware
// =========================
app.use(cors());
app.use(express.json());

// 정적 파일 서빙 (Render 배포용)
app.use(express.static(__dirname));

// =========================
// Database Utility
// =========================
function readDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { posts: [] };
    }

    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data || '{"posts":[]}');
  } catch (error) {
    console.error('Error reading database:', error);
    return { posts: [] };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}

// =========================
// API Routes
// =========================

// 1. Get all posts
app.get('/api/posts', (req, res) => {
  const db = readDatabase();
  const safePosts = db.posts.map(({ password, ...rest }) => rest);
  res.json(safePosts);
});

// 2. Get single post
app.get('/api/posts/:id', (req, res) => {
  const db = readDatabase();
  const targetId = parseInt(req.params.id, 10);
  const post = db.posts.find(p => p.id === targetId);

  if (!post) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  const { password, ...safePost } = post;
  res.json(safePost);
});

// 3. Create post
app.post('/api/posts', (req, res) => {
  const { title, content, author, password } = req.body;

  if (!title || !content || !author || !password) {
    return res.status(400).json({
      error: '모든 항목(제목, 본문, 작성자, 비밀번호)을 입력해 주세요.'
    });
  }

  const db = readDatabase();
  const newId =
    db.posts.length > 0
      ? Math.max(...db.posts.map(p => p.id)) + 1
      : 1;

  const now = new Date();
  const formattedDate =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ` +
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const newPost = {
    id: newId,
    title,
    author,
    content,
    password,
    date: formattedDate,
    views: 0
  };

  db.posts.push(newPost);
  writeDatabase(db);

  const { password: _, ...safePost } = newPost;
  res.status(201).json(safePost);
});

// 4. Verify password
app.post('/api/posts/:id/verify', (req, res) => {
  const { password } = req.body;
  const targetId = parseInt(req.params.id, 10);

  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
  }

  const db = readDatabase();
  const post = db.posts.find(p => p.id === targetId);

  if (!post) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  if (post.password === password) {
    res.json({ success: true });
  } else {
    res.status(400).json({
      success: false,
      error: '비밀번호가 일치하지 않습니다.'
    });
  }
});

// 5. Increase views
app.post('/api/posts/:id/view', (req, res) => {
  const db = readDatabase();
  const targetId = parseInt(req.params.id, 10);
  const post = db.posts.find(p => p.id === targetId);

  if (!post) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  post.views = (post.views || 0) + 1;
  writeDatabase(db);

  res.json({
    success: true,
    views: post.views
  });
});

// 6. Update post
app.put('/api/posts/:id', (req, res) => {
  const { title, content, password } = req.body;
  const targetId = parseInt(req.params.id, 10);

  if (!title || !content || !password) {
    return res.status(400).json({
      error: '모든 항목(제목, 본문, 비밀번호)을 입력해 주세요.'
    });
  }

  const db = readDatabase();
  const postIndex = db.posts.findIndex(p => p.id === targetId);

  if (postIndex === -1) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  const post = db.posts[postIndex];

  if (post.password !== password) {
    return res.status(403).json({
      error: '비밀번호가 일치하지 않습니다.'
    });
  }

  post.title = title;
  post.content = content;
  writeDatabase(db);

  const { password: _, ...safePost } = post;
  res.json(safePost);
});

// 7. Delete post
app.delete('/api/posts/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const password = req.body.password || req.query.password;

  if (!password) {
    return res.status(400).json({ error: '비밀번호를 입력해 주세요.' });
  }

  const db = readDatabase();
  const postIndex = db.posts.findIndex(p => p.id === targetId);

  if (postIndex === -1) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  const post = db.posts[postIndex];

  if (post.password !== password) {
    return res.status(403).json({
      error: '비밀번호가 일치하지 않습니다.'
    });
  }

  db.posts.splice(postIndex, 1);
  writeDatabase(db);

  res.json({
    success: true,
    message: '게시글이 삭제되었습니다.'
  });
});

// =========================
// Frontend Route (수정)
// =========================
// 모든 요청을 index.html로 보내기 (SPA 방식)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================
// Server Start
// =========================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});