const mongoose = require('mongoose')
const User = require('../../models/user')
const Conversations = require('../../models/conversations')
const bcrypt = require('bcrypt')
const { sendErrorMessage, getPairTokens } = require('../../utils/helpers')

const getAll = (req, res) => {
  User.find()
    .select('-__v')
    .exec()
    .then(docs => {
      res.status(200).json({
        message: 'Users loaded successfully',
        data: docs,
      })
    })
    .catch(sendErrorMessage(res))
}

const getOne = (req, res) => {
  User.findById(req.params.id)
    .select('_id email')
    .exec()
    .then(doc => {
      if (doc) {
        res.status(200).json({
          message: 'User data loaded.',
          user: doc
        })
      } else {
        res.status(404).json({
          message: 'Unable to load user data. No data for this id.'
        })
      }
    })
    .catch(sendErrorMessage(res))
}

const getName = (req, res) => {
  User.findOne({ name: req.params.name })
    .exec()
    .then(user => {
      if (user) {
        res.status(200).json({
          error: true,
          message: 'User name exists.',
        })
      } else {
        res.status(200).json({
          message: 'User name doesn\'t exist',
        })
      }
    })
    .catch(sendErrorMessage(res))
}

const getEmail = (req, res) => {
  User.findOne({ email: req.params.email })
    .exec()
    .then(user => {
      if (user) {
        res.status(200).json({
          error: true,
          message: 'Email already registered.',
        })
      } else {
        res.status(200).json({
          message: 'Email available for registration.',
        })
      }
    })
    .catch(sendErrorMessage(res))
}

const signUp = (req, res) => {
  console.log('TCL: req.body', req.body)
  const name = User.findOne({ name: req.body.name })
    .select('name')
    .exec()

  const email = User.findOne({ email: req.body.email })
    .select('email')
    .exec()

  Promise.all([ name, email ])
    .then(result => {
      const isFound = result && result.some((item) => item !== null)
      if (isFound) {
        const data = {}
        if (result[0]) { data.name = result[0].name }
        if (result[1]) { data.email = result[1].email }
        res.status(200).json({
          error: 'That registration data already taken.',
          data,
        })
      }
      return bcrypt.hash(req.body.password, 10)
    })
    .then(hash => {
      const newUser = new User({
        _id: new mongoose.Types.ObjectId(),
        name: req.body.name,
        email: req.body.email,
        password: hash,
      })
      return newUser.save()
    })
    .then(user => {
      console.log('TCL: doc._id', user._id)
      res.status(201).json({
        message: 'User created successfully',
        createdUser: {
          _id: user._id,
          name: user.name,
          email: user.email,
        },
      })
    })
    .catch(sendErrorMessage(res))
}

const signIn = (req, res) => {
  let foundUser, userData, pairTokens
  User.findOne({ name: req.body.name }).exec()
    .then(async (user) => {
      if (!user) {
        res.status(401).json({
          error: true,
          message: `Auth failed. User ${req.body.name} isn't registered.`
        })
      }
      foundUser = user
      return bcrypt.compare(req.body.password, user.password)
    })
    .then((isPassCompareSucces) => {
      if (isPassCompareSucces) {
        userData = {
          id: foundUser.id,
          name: foundUser.name,
          role: null,
        }
        pairTokens = getPairTokens(userData)

        return User.updateOne({ _id: foundUser.id }, { refreshToken: pairTokens.refreshToken })
      }
      res.status(401).json({
        error: 'Auth failed. Passwords doesn\'t match'
      })
    })
    .then(updatedUser => {
      if (!updatedUser) { throw new Error('Error updating user.')}
      res.status(201).json({
        message: `User ${foundUser.name} is logged in.`,
        data: {
          ...userData,
          ...pairTokens,
        }
      })
    })
    .catch(sendErrorMessage(res))
}

const signInFb = (req, res) => {
  User.findOne({ id_fb: req.body.id })
    .exec()
    .then(user => {
      if(user) {
        return user
      }
      return new User({
        _id: new mongoose.Types.ObjectId(),
        id_fb: req.body.id,
        name: req.body.name,
        userPic: req.body.userPic
      }).save()
    })
    .then(user => {
      if (!user) { throw new Error('Error getting user from database.')}
      const userData = {
        id: user.id,
        name: user.name,
        role: null,
      }
      const pairTokens = getPairTokens(userData)
      User.updateOne({ _id: user.id }, { refreshToken: pairTokens.refreshToken })
        .then(updatedUser => {
          if (!updatedUser) { throw new Error('Error updating user.')}
          res.status(200).json({
            message: `User ${user.name} is logged in.`,
            data: {
              ...userData,
              userPic: user.userPic,
              ...pairTokens,
            }
          })
        })
    })
    .catch(sendErrorMessage(res))
}

const remove = (req, res) => {
  User.findByIdAndRemove(req.params.id)
    .select('_id email')
    .exec()
    .then(user => {
      if (user) {
        res.status(200).json({
          message: 'User data deleted.',
          deletedUser: user
        })
      } else {
        res.status(404).json({
          message: 'Unable to delete user data. No data for this id.'
        })
      }
    })
    .catch(sendErrorMessage(res))
}

const getUserChats = (req, res) => {  // TODO: Lepin > null !== null
  Conversations.find({ members: { $in: [ req.params.id ] } })
    .exec()
    .then((conversations) => {
      res.status(200).json({
        data: conversations,
      })
    })
    .catch(sendErrorMessage(res))
}

const refreshUserToken = (req, res) => {
  User.findById(req.body.id)
    .exec()
    .then((user) => {
      if (!user) {
        res.status(404).json({
          error: `User with id ${req.body.id} not found.`
        })
      }
      const isRefreshTokenVerified = user.refreshToken && user.refreshToken === req.body.refreshToken
      if (isRefreshTokenVerified) {
          const userData = {
          id: user.id,
          name: user.name,
          role: null,
        }
        const pairTokens = getPairTokens(userData)
        User.updateOne({ _id: user.id }, { refreshToken: pairTokens.refreshToken })
          .then(updatedUser => {
            if (updatedUser) {
              res.status(200).json({
                data: pairTokens,
                message: 'Tokens refreshed successfull.'
              })
            }
          })
      } else {
        res.status(401).json({
          error: 'Refresh token verification failed.'
        })
      }
    })
    .catch(sendErrorMessage(res))
}

module.exports = {
  getAll,
  getOne,
  getName,
  getEmail,
  signUp,
  signIn,
  signInFb,
  remove,
  getUserChats,
  refreshUserToken,
}
