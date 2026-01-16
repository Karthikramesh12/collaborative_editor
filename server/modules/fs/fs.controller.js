const { PrismaClient } = require("../../generated/prisma");
const prisma = new PrismaClient();
const CollabEngine = require("../../realtime/engine/collab.engin.js");

function splitPath(path) {
  return path.split("/").filter(Boolean);
}

async function resolveNode(workspaceId, path) {
  let parentId = null;

  for (const name of splitPath(path)) {
    const node = await prisma.file.findFirst({
      where: { workspaceId, parentId, name }
    });
    if (!node) return null;
    parentId = node.id;
  }

  return parentId
    ? prisma.file.findUnique({ where: { id: parentId } })
    : null;
}

exports.stat = async (req, res) => {
  if (!req.query.path) {
    return res.json({
      type: 2,
      size: 0,
      ctime: 0,
      mtime: Date.now()
    });
  }

  const node = await resolveNode(req.params.ws, req.query.path);
  if (!node) return res.sendStatus(404);

  res.json({
    type: node.type === "DIR" ? 2 : 1,
    size: node.content?.length || 0,
    ctime: 0,
    mtime: Date.now()
  });
};


exports.list = async (req, res) => {
  const parent = req.query.parent
    ? await resolveNode(req.params.ws, req.query.parent)
    : null;

  const nodes = await prisma.file.findMany({
    where: {
      workspaceId: req.params.ws,
      parentId: parent?.id || null
    }
  });

  res.json(nodes.map(n => [n.name, n.type === "DIR" ? 2 : 1]));
};

exports.read = async (req, res) => {
  const node = await resolveNode(req.params.ws, req.query.path);
  if (!node) return res.sendStatus(404);
  res.send(node.content || "");
};

exports.write = async (req, res) => {
  const { path, content } = req.body;
  const workspaceId = req.params.ws;

  const node = await resolveNode(workspaceId, path);
  if (!node || node.type !== "FILE") {
    return res.sendStatus(404);
  }

  // 1. Push content into collab engine
  await CollabEngine.absorbFsContent(
    node.id,
    content
  );

  // 2. (Optional) Update cached snapshot in DB
  await prisma.file.update({
    where: { id: node.id },
    data: {
      content,
      version: { increment: 1 }
    }
  });

  res.sendStatus(200);
};


exports.mkdir = async (req, res) => {
  const parts = splitPath(req.body.path);
  const name = parts.pop();
  const parent = parts.length
    ? await resolveNode(req.params.ws, parts.join("/"))
    : null;

  await prisma.file.create({
    data: {
      workspaceId: req.params.ws,
      parentId: parent?.id || null,
      name,
      type: "DIR",
      content: ""
    }
  });

  res.sendStatus(200);
};

exports.del = async (req, res) => {
  const node = await resolveNode(req.params.ws, req.body.path);
  if (node) {
    await prisma.file.delete({ where: { id: node.id } });
  }
  res.sendStatus(200);
};

exports.move = async (req, res) => {
  const node = await resolveNode(req.params.ws, req.body.oldPath);
  if (!node) return res.sendStatus(404);

  const parts = splitPath(req.body.newPath);
  const name = parts.pop();
  const parent = parts.length
    ? await resolveNode(req.params.ws, parts.join("/"))
    : null;

  await prisma.file.update({
    where: { id: node.id },
    data: {
      parentId: parent?.id || null,
      name
    }
  });

  res.sendStatus(200);
};
