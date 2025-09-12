import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const sseAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization
    let token = auth?.startsWith('Bearer ') ? auth.split(' ')[1] : null
    if (!token && req.query?.token) token = String(req.query.token)

    if (!token) return res.status(401).json({ success:false, message:'Missing token' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id)
    if (!user) return res.status(401).json({ success:false, message:'Invalid user' })

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ success:false, message:'Unauthorized' })
  }
}
