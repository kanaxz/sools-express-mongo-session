const { nanoid } = require('nanoid')
const moment = require('moment')

const TOKEN_KEY = 'sessionToken'
const TOKEN_AGE = 30

const Express = require('sools-express')

module.exports = {
  name: 'sessions',
  dependencies: [
    Express,
    require('sools-mongo'),
  ],
  after: Express,
  async construct({ express, mongo }, config) {
    const collection = mongo.db.collection('sessions')

    const get = async (req) => {
      const _id = req.cookies[TOKEN_KEY]
      let session = await collection.findOne({
        _id,
      })
      if (session) {
        if (session.expireDate < new Date()) {
          await collection.deleteOne({
            _id,
          })
          session = null
        }
      }
      return session
    }

    const create = async (req) => {
      const session = {
        _id: nanoid(),
      }

      await collection.insertOne(session)
      return session
    }

    const getOrCreate = async (req) => {
      let session = await get(req)
      if (!session) {
        session = await create(req)
      }
      return session
    }

    express.use(async (req, res, next) => {
      try {
        const session = await getOrCreate(req)
        session.expireDate = moment().add(TOKEN_AGE, 'days').toDate()

        res.cookie(TOKEN_KEY, session._id, {
          maxAge: 1000 * 60 * 60 * 24 * TOKEN_AGE,
          httpOnly: true,
          domain: `.${config.express.host}`,
          secure: true,
          sameSite: 'none'
        })

        req.session = session

        res.on('finish', async () => {
          await collection.updateOne({
            _id: session._id,
          }, {
            $set: session
          })
        })
        next()
      } catch (err) {
        console.error(err)
        next(err)
      }
    })
  }
}