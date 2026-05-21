const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      users: [],
      orders: [],
      stickers: [],
      admins: []
    }, null, 2));
  }
  function writeData(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

const DATA_FILE = path.join(__dirname, "data.json");
const ORDERS_FILE = path.join(__dirname, "orders.json");
const USERS_FILE = path.join(__dirname, "users.json");
const UPLOAD_DIR = path.join(__dirname, "public", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, "sticker-" + Date.now() + ext);
  }
});

const upload = multer({ storage });

function ensureFile(file, defaultData) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultData, null, 2), "utf8");
  }
}

ensureFile(DATA_FILE, {
  siteName: "5-2 스티커가게",
  title: "세상에 하나뿐인 스티커를 만들어보세요!",
  desc: "이미지 업로드, 커스텀 주문, 가격 계산까지 가능한 공식 주문사이트입니다.",
  notice: "👑 관리자 승인제로 안전하게 주문됩니다!",
  emoji: "🎀",
  popular: "고양이 왕관 스티커"
});

ensureFile(ORDERS_FILE, {
  pending: [],
  approved: []
});

ensureFile(USERS_FILE, {
  users: []
});

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    if (file === ORDERS_FILE) return { pending: [], approved: [] };
    if (file === USERS_FILE) return { users: [] };
    return {};
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function checkPassword(password) {
  return password === "kms0727hi";
}

function makeOrderNumber() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const r = Math.floor(1000 + Math.random() * 9000);
  return `MS-${y}${m}${day}-${r}`;
}

function calcPrice(item, size, quantity, hasImage) {
  let base = 1000;

  if (item.includes("랜덤")) base =0;
  if (item.includes("콩떡")) base = 0;
  if (item.includes("민상코드")) base = 0;
  if (item.includes("커스텀")) base = 0;

  if (size === "작게") base -= 0;
  if (size === "크게") base +=0;
  if (hasImage) base += 0;

  return Math.max(base, 0) * Number(quantity || 1);
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/order", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/data", (req, res) => {
  res.json(readJson(DATA_FILE));
});

app.get("/api/orders", (req, res) => {
  const orders = readJson(ORDERS_FILE);
  orders.pending ||= [];
  orders.approved ||= [];
  res.json(orders);
});

app.get("/api/users", (req, res) => {
  const users = readJson(USERS_FILE);
  users.users ||= [];
  res.json(users);
});

app.post("/api/register", (req, res) => {
  const users = readJson(USERS_FILE);
  users.users ||= [];

  const { username, password, nickname } = req.body;

  if (!username || !password) {
    return res.status(400).json({ ok: false, message: "아이디와 비밀번호가 필요합니다." });
  }

  const exists = users.users.find(u => u.username === username);

  if (exists) {
    return res.status(409).json({ ok: false, message: "이미 있는 아이디입니다." });
  }

  const user = {
    id: Date.now(),
    username,
    password,
    nickname: nickname || username,
    createdAt: new Date().toLocaleString("ko-KR")
  };

  users.users.push(user);
  writeJson(USERS_FILE, users);

  res.json({ ok: true, message: "회원가입 완료", user });
});

app.post("/api/login", (req, res) => {
  const users = readJson(USERS_FILE);
  users.users ||= [];

  const user = users.users.find(
    u => u.username === req.body.username && u.password === req.body.password
  );

  if (!user) {
    return res.status(403).json({ ok: false, message: "로그인 실패" });
  }

  res.json({ ok: true, message: "로그인 성공", user });
});

app.post("/api/order", upload.single("image"), (req, res) => {
  const orders = readJson(ORDERS_FILE);
  orders.pending ||= [];
  orders.approved ||= [];

  const hasImage = !!req.file;
  const imageUrl = hasImage ? `/uploads/${req.file.filename}` : "";

  const price = calcPrice(
    req.body.item || "직접 커스텀 디자인",
    req.body.size || "보통",
    req.body.quantity || "1",
    hasImage
  );

  const newOrder = {
    id: Date.now(),
    orderNumber: makeOrderNumber(),
    username: req.body.username || "비회원",
    name: req.body.name || "이름없음",
    item: req.body.item || "직접 커스텀 디자인",
    customText: req.body.customText || "",
    color: req.body.color || "",
    size: req.body.size || "",
    quantity: req.body.quantity || "1",
    phone: req.body.phone || "",
    memo: req.body.memo || "",
    imageUrl,
    previewText: req.body.previewText || "",
    price,
    status: "승인대기",
    createdAt: new Date().toLocaleString("ko-KR")
  };

  orders.pending.push(newOrder);
  writeJson(ORDERS_FILE, orders);

  console.log("🔔 새 주문 들어옴:", newOrder.orderNumber);

  res.json({
    ok: true,
    message: "주문 신청 완료",
    order: newOrder
  });
});

app.get("/api/orders", (req, res) => {
  const orders = readJson(ORDERS_FILE);

  orders.pending ||= [];
  orders.approved ||= [];

  res.json({
    ok: true,
    orders
  });
});
app.post("/api/admin/check", (req, res) => {
  if (checkPassword(req.body.password)) {
    res.json({ ok: true });
  } else {
    res.status(403).json({ ok: false });
  }
});

app.post("/api/admin/login", (req, res) => {
  if (checkPassword(req.body.password)) {
    res.json({ ok: true, message: "관리자 로그인 성공" });
  } else {
    res.status(403).json({ ok: false });
  }
});

app.post("/api/admin/approve", (req, res) => {
  const { password, id } = req.body;

  if (!checkPassword(password)) {
    return res.status(403).json({ ok: false });
  }

  const orders = readJson(ORDERS_FILE);
  orders.pending ||= [];
  orders.approved ||= [];

  const orderId = Number(id);
  const index = orders.pending.findIndex(order => Number(order.id) === orderId);

  if (index === -1) {
    return res.status(404).json({ ok: false });
  }

  const order = orders.pending.splice(index, 1)[0];
  order.status = "승인완료";
  order.approvedAt = new Date().toLocaleString("ko-KR");

  orders.approved.push(order);
  writeJson(ORDERS_FILE, orders);

  res.json({ ok: true, order });
});

app.post("/api/admin/reject", (req, res) => {
  const { password, id } = req.body;

  if (!checkPassword(password)) {
    return res.status(403).json({ ok: false });
  }

  const orders = readJson(ORDERS_FILE);
  orders.pending ||= [];
  orders.approved ||= [];

  orders.pending = orders.pending.filter(order => Number(order.id) !== Number(id));
  writeJson(ORDERS_FILE, orders);

  res.json({ ok: true });
});

app.post("/api/admin/clear-approved", (req, res) => {
  const { password } = req.body;

  if (!checkPassword(password)) {
    return res.status(403).json({ ok: false });
  }

  const orders = readJson(ORDERS_FILE);
  orders.pending ||= [];
  orders.approved = [];

  writeJson(ORDERS_FILE, orders);
  res.json({ ok: true });
});

app.post("/api/admin/save", (req, res) => {
  const { password, data } = req.body;

  if (!checkPassword(password)) {
    return res.status(403).json({ ok: false });
  }

  writeJson(DATA_FILE, data || {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log(`서버 실행됨: http://localhost:${PORT}`);
  console.log(`주문 페이지: http://localhost:${PORT}/order`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin`);
  console.log("--------------------------------");
});