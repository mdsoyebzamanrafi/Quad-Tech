module.exports = (req, res, next) => {
  // Mock authentication middleware
  // Ensures that action is taken by the logged in user
  const authUserId = req.headers['x-user-id'] || req.body.userId || req.body.requesterId;
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = { _id: authUserId };
  next();
};
