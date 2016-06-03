const requireUncached = require('require-uncached')

require('chai').should()
const sinon = require('sinon')
const nock = require('nock')

const orders = require('./fixtures/orders')
const login = require('./fixtures/login')
const badLogin = require('./fixtures/bad-login')
const instruments = require('./fixtures/instruments')
const output = require('./fixtures/output.csv')

const main = require('../lib/main')
const utils = require('../lib/utils')

const mockAuth = {
  username: 'foo',
  password: 'bar'
}

const badAuth = {
  username: 'totes invalid username',
  password: 'bad password'
}

const argvBackup = Array(...process.argv)

describe('Binary', () => {
  let scope

  beforeEach(() => {
    process.argv = ['node', 'robinhood-to-csv.js']

    scope = nock('https://api.robinhood.com')

    scope
      .post('/api-token-auth/', mockAuth)
      .reply(200, login)

      .post('/api-token-auth/', badAuth)
      .reply(400, badLogin)

      .get('/orders/')
      .query({ cursor: '' })
      .reply(200, orders[0])

      .get('/orders/')
      .query({ cursor: 'zero' })
      .reply(200, orders[0])

      .get('/orders/')
      .query({ cursor: 'one' })
      .reply(200, orders[1])

      .get(/\/instruments\/.+/)
      .reply(200, (uri) => instruments[utils.pluckLastOfPath(uri)])
      .persist()
  })

  afterEach(() => {
    process.argv = Array(...argvBackup)
    nock.cleanAll()
  })

  it('imports main lib', () => {
    main.should.be.ok
  })

  describe('arguments', () => {
    beforeEach(() => {
      sinon.stub(main, 'printCsv')
      sinon.spy(main, 'login')
      process.argv.push('--username', 'foo')
      process.argv.push('--password', 'bar')
    })

    afterEach(() => {
      main.printCsv.restore()
      main.login.restore()
    })

    describe('username', () => {
      it('is accepted in long form', (done) => {
        requireUncached('../bin/robinhood-to-csv').then(() => {
          main.login.calledWithMatch({ username: 'foo' }).should.be.true
          done()
        })
      })
    })

    describe('password', () => {
      it('is accepted in long form', (done) => {
        requireUncached('../bin/robinhood-to-csv').then(() => {
          main.login.calledWithMatch({ password: 'bar' }).should.be.true
          done()
        })
      })
    })
  })

  describe('output', () => {
    beforeEach(() => {
      sinon.stub(main, 'printCsv')
      process.argv.push('--username', 'foo')
      process.argv.push('--password', 'bar')
    })

    afterEach(() => { main.printCsv.restore() })

    it('prints csv to stdout', (done) => {
      requireUncached('../bin/robinhood-to-csv').then(() => {
        main.printCsv.calledWith(output).should.be.true
        done()
      })
    })
  })

  describe('with errors', () => {
    beforeEach(() => {
      sinon.stub(console, 'error')
      sinon.stub(process, 'exit')
      process.argv.push('--username', 'totes invalid username')
      process.argv.push('--password', 'bad password')
    })

    afterEach(() => {
      console.error.restore()
      process.exit.restore()
    })

    it('throws the errors and exits', (done) => {
      requireUncached('../bin/robinhood-to-csv').then(() => {
        console.error.calledWithMatch({ data: badLogin }).should.be.true
        process.exit.calledWith(1).should.be.true
        done()
      })
    })
  })
})
