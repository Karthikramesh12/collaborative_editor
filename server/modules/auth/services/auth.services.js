const jwt = require("jsonwebtoken");
const prisma = require('../../../config/prisma.js');
const { hash, verify } = require('../../../utils/password.js');

async function signUp(email, password, name) {
  const normalized = email.toLowerCase().trim();

  const exists = await prisma.user.findUnique({
    where:{
      email: normalized,
    }
  });

  if (exists) {
    throw new Error("EMAIL_EXISTS");
  }

  const passwordHash = await hash(password);

  const user = await prisma.user.create({
    data:{
      email: normalized,
      name,
      authProviders:{
        create:{
          provider:"EMAIL",
          passwordHash
        }
      }
    }
  });

  const token = jwt.sign({ userId: user.id}, process.env.JWT_SECERT, { expiresIn: "7d"});
  return { user, token };
}

async function login(email, password) {
  const user = await prisma.user.findUnique({
    where:{
      email: email.toLowerCase().trim(),
    },
    include:{
      authProviders: true
    },
  });

  if (!user){
    throw new Error("INVALID");
  }

  const provider = user.authProviders.find(p => p.provider === "EMAIL");
  if (!provider){
    throw new Error("INVALID");
  }

  const ok = await verify(password, provider.passwordHash);
  if (!ok){
    throw new Error("INVALID");
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECERT, {expiresIn: "7d"});
  return { user, token };
}

module.exports = {
  signUp,
  login,
}