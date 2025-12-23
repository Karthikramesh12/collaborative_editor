const prisma = require('../prisma');
const { comparePassword, hashPassword } = require('../utils/password');

async function signUp(email, userName, password) {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { userName }],
    },
  });

  if (existingUser) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      email,
      userName,
      passwordHash,
    },
  });
}

async function login(email, password) {
  const user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const isValid = await comparePassword(password, user.passwordHash);

  if (!isValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return user;
}

module.exports = {
  signUp,
  login,
};
