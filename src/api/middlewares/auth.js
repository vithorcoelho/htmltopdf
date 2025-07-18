function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== process.env.API_TOKEN) {
    return res.status(403).json({ error: 'Token inválido' });
  }
  
  next();
}

module.exports = authenticate;
