const Authentication = artifacts.require('./Authentication.sol')

function watchSignup(authentication, account, currentBlock, name, field) {
  return new Promise((resolve, reject) => {
    const event = authentication.LogSignup({user: account}, {fromBlock: currentBlock, toBlock: 'latest'})
    event.watch((error, result) => {
      resolve(error)
      event.stopWatching()
    })
    authentication.signup(name, field, {from: account})
  })
}

function getSignup(authentication, account) {
  return new Promise((resolve, reject) => {
    const event = authentication.LogSignup({user: account})
    event.get((error, result) => {
      resolve(result)
      event.stopWatching()
    })
  })
}

before(async () => {
  authentication = await Authentication.new()
})

contract('Authentication', accounts => {
  const defaultAccount = accounts[0]
  const otherAccount = accounts[1]
  const defaultField = 0
  const defaultError = /revert/

  it('should sign up and log in a user.', async () => {
    username = 'testuser'
    await authentication.signup(username, defaultField, {from: defaultAccount})
    const event = await getSignup(authentication, defaultAccount)
    assert.equal(web3.toUtf8(event[0].args.name), username, 'The user was not signed up')
    const result = await authentication.login.call()
    assert.equal(web3.toUtf8(result[0]), username, 'The user was not signed up')
    assert.equal(result[1].toNumber(), defaultField, 'The user was not signed up')
  })

  it('should not log in an unexisting user', async () => {
    try {
      await authentication.login.call({from: otherAccount})
      assert(false, 'Non existing user was able to login')
    } catch (error) {
      assert.match(error.message, defaultError, 'Call failed but for who knows why')
    }
  })

  it('should not sign up with invalid name', async () => {
    try {
      await authentication.signup('', defaultField, {from: otherAccount})
      assert(false, 'User was able to sign up with empty name')
    } catch (error) {
      assert.match(error.message, defaultError, 'Call failed but for who knows why')
    }
  })

  it('should not sign up with invalid field', async () => {
    try {
      await authentication.signup('Vitalik', 2, {from: otherAccount})
      assert(false, 'User was able to sign up with invalid field')
    } catch (error) {
      assert.match(error.message, defaultError, 'Call failed but for who knows why')
    }
  })

  it('should fire an event when a user signs up', async () => {
    const error = await watchSignup(authentication, otherAccount, web3.eth.blockNumber, 'Vitalik', defaultField)
    assert.equal(error, null, 'Watcher returned error')
  })
})
