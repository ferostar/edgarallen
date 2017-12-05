// Libraries
const CryptoJS = require("crypto-js")
const Storage = require("../utils/storage.js")
const fileDownload = require("js-file-download")

import React, { Component } from 'react'
import Contract from 'truffle-contract'

// Contract Abis
import Authentication from '../build/contracts/Authentication.json'
import Documenter from '../build/contracts/Documenter.json'

// Utils
import getWeb3 from './utils/getWeb3'
import promisify from './utils/promisify'

// Components
import AddFileForm from './components/AddFileForm'
import DocumentList from './components/DocumentList'
import DocumentReader from './components/DocumentReader'
import CategoryList from './components/CategoryList'

// Currently... everything is here. And i do mean it. Everything. Will eventually grow into a much nicer codebase, of course.
export default class App extends Component {
  constructor(props) {
    super(props)

    // Set default state
    this.state = {
      categories: ["Quantum Physics", "Lepufology"], // Taken from Documenter.sol
      selectedCategory: 0, // Both this and categoryDocuments are just a sample of data analytics
      caterogyDocuments: [],
      documents: [],
      defaultAccount: undefined,
      authenticationInstance: undefined,
      documenterInstance: undefined,
      web3: undefined,
      name: undefined,
      storage_id: undefined,
      storage_version: undefined,
      storage_protocol: undefined,
      selectedDocument: undefined
    }
  }

  componentWillMount() {
    this.initialize()
    .then(() => {
      this.watchNewDocuments()
    })
  }

  async initialize() {
    const { web3 } = await getWeb3

    // setup and store deployed contracts
    const authentication = Contract(Authentication)
    authentication.setProvider(web3.currentProvider)
    const documenter = Contract(Documenter)
    documenter.setProvider(web3.currentProvider)
    const accounts = await promisify(web3.eth.getAccounts)
    console.log(accounts[0])

    const defaultAccount = accounts[0]

    const authenticationInstance = await authentication.deployed()
    const documenterInstance = await documenter.deployed()

    this.setState({
      ...this.state,
      web3,
      defaultAccount,
      authenticationInstance,
      documenterInstance,
    })

    // setup IPFS
    Storage.start('ipfs-paperchain').then(error => {
      return Storage.id()
    }).then(info => {
      this.setState({
        storage_id: info[0],
        storage_version: info[1],
        storage_protocol: info[2]
      })
    })

    // get logged in user, otherwise request user (un)friendly signup
    var name
    try {
      name = await authenticationInstance.login.call({from: defaultAccount})
      this.didLogin(web3.toUtf8(name))
    } catch (error) {
      do {
        name = prompt("Please enter your user name")
      } while (name === null || name === "" )
      await authenticationInstance.signup(name, {from: defaultAccount})
      this.didLogin(name)
    }

    // No need to have a logged in user to get documents by category
    this.loadCategoryDocuments(0)
  }

  didLogin(name) {
    // store user name in state and load documents
    this.setState({
      ...this.state,
      name: name
    })
    this.loadDocuments()
  }

  onFileAdd(file, category, quotes) {
    // check if IPFS setup has completed
    if (this.state.storage_id === undefined) {
      alert("Please wait for IPFS to finish loading")
      return
    }
    // check if we have a logged in user
    if (this.state.name === undefined) {
      alert("Please sign up before adding the file (hit reload)")
      return
    }
    const { documenterInstance, defaultAccount } = this.state
    const index = this.state.categories.indexOf(category)

    // read file and get it's hash
    var reader = new FileReader();
    reader.onload = async event => {
      if (event === undefined) return
      const binary = event.target.result;
      var hash = CryptoJS.MD5(binary).toString()
      // check if the document exists. hey, this should use `await` instead of promises
      var exists = await documenterInstance.documentExists.call(hash)
      if (exists) {
        alert("Document already exists")
        return
      }
      var multihash = await Storage.add(file.name, Buffer.from(binary))
      if (multihash !== undefined) {
        documenterInstance.notarizeDocument(file.name, index, quotes, hash, multihash, Date.now(), { from: defaultAccount })
      }
    }
    reader.readAsBinaryString(file)
  }

  async loadDocuments() {
    console.log("about to load")
    // load user's documents off-storage ;) -had to simplify some things in order to get started this way, but it's worth it
    const { documenterInstance, defaultAccount } = this.state
    var blockNumber = await documenterInstance.getDeploymentBlockNumber.call()
    // filter so only documents created by the user are fetched starting when the contract was deployed are fetched (better than zero)
    documenterInstance.LogNewDocument({owner: defaultAccount}, {fromBlock: blockNumber, toBlock: "latest"}).get((error, result) => {
      if (error) {
        console.log("Nooooo! " + error)
      } else {
        console.log(result)
        var documents = result.map(x => { return x.args })
        this.setState({...this.state, documents: documents})
      }
    })
  }

  async watchNewDocuments() {
    // watch for new registered documents
    const { web3, documenterInstance, defaultAccount } = this.state
    var blockNumber = await promisify(web3.eth.getBlockNumber)
    // filter so only documents created by the user are fetched and starting in the current block
    documenterInstance.LogNewDocument({owner: defaultAccount}, {fromBlock: blockNumber, toBlock: "latest"}).watch((error, result) => {
      if (error) {
        console.log("Nooooo! " + error)
      } else {
        console.log("Result: " + JSON.stringify(result.args))
        // just in case: check if the document hasn't been added already
        if (this.state.documents.filter(document => (document.hash === result.args.hash)).length === 0) {
          this.setState({...this.state, documents: [...this.state.documents, result.args]})
        }
      }
    })
  }

  onRead(doc) {
    this.setState({...this.state, selectedDocument: doc})
  }

  async onDownload(doc) {
    // check if IPFS setup has completed
    if (this.state.storage_id === undefined) {
      alert("Please wait for IPFS to finish loading")
    }
    const { web3 } = this.state
    const multihash = web3.toAscii(doc.multihash)
    const raw = await Storage.cat(multihash)

    fileDownload(raw, doc.name)
  }

  // Category related

  async loadCategoryDocuments(category) {
    // loadDocuments() variation
    const { documenterInstance } = this.state
    var blockNumber = await documenterInstance.getDeploymentBlockNumber.call()
    documenterInstance.LogNewDocument({category: category}, {fromBlock: blockNumber, toBlock: "latest"}).get((error, result) => {
      if (error) {
        console.log("Nooooo! " + error)
      } else {
        console.log(result)
        var documents = result.map(x => { return x.args })
        console.log(documents)
        this.setState({...this.state, categoryDocuments: documents})
      }
    })
  }

  onCategoryChange(category) {
    this.setState({...this.state, selectedCategory: category})
    this.loadCategoryDocuments(category)
  }

  render() {
    return (
      <div>
      <h1>{ this.state.name === undefined ? "Paperchain" : "Hi, " + this.state.name + "!"}</h1>
      <hr/>
      <AddFileForm name={this.state.name} options={this.state.categories} onFileAdd={this.onFileAdd.bind(this)} />
      <p>Your ID is <strong>{this.state.storage_id}</strong></p>
      <p>Your IPFS version is <strong>{this.state.storage_version}</strong></p>
      <p>Your IPFS protocol version is <strong>{this.state.storage_protocol}</strong></p>
      <hr/>
      <DocumentList documents={this.state.documents} onRead={this.onRead.bind(this)}/>
      <hr/>
      <DocumentReader doc={this.state.selectedDocument} categories={this.state.categories} web3={this.state.web3} onDownload={this.onDownload.bind(this)}/>
      <hr/>
      <hr/>
      <CategoryList options={this.state.categories} documents={this.state.categoryDocuments} onCategoryChange={this.onCategoryChange.bind(this)} />
      </div>
    )
  }
}
