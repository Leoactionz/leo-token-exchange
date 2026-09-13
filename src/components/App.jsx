import React, { Component } from 'react';
import './App.css';
import Web3 from 'web3'
import Navbar from './Navbar';
import Content from './Content';
import { connect } from 'react-redux'
import Token from '../abis/Token.json'
import { loadWeb3, loadAccount, loadToken, loadExchange } from '../store/interactions'
import { contractLoadedSelector } from '../store/selectors';



class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      networkError: false // Add local state for errors
    }
  }

  componentDidMount() {
    this.loadBlockchainData(this.props.dispatch)
  }

  async loadBlockchainData(dispatch) {
    try {
      const web3 = await loadWeb3(dispatch)
      // Request account access — triggers MetaMask popup
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      const networkId = await web3.eth.net.getId()
      await loadAccount(web3, dispatch)

      const token = await loadToken(web3, networkId, dispatch)
      if (!token) {
        this.setState({ networkError: true });
        return
      }

      const exchange = await loadExchange(web3, networkId, dispatch)
      if (!exchange) {
        this.setState({ networkError: true });
        return
      }

    } catch (error) {
      console.error("Failed to load blockchain data:", error)
    }
  }

  render() {

    return (
      <div>
        <Navbar />
        {this.state.networkError ? (
          <div className="content text-center text-danger mt-5">
            <h3>⚠️ Network Error</h3>
            <p>Smart contracts not detected on the current network.</p>
            <p>Please select the correct network (e.g. Localhost 7545) in MetaMask.</p>
          </div>
        ) : this.props.contractsLoaded ? <Content /> : <div className="content">Loading...</div>}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    contractsLoaded: contractLoadedSelector(state),
  }
}

// function mapDispatchToProps(dispatch) {
//   return {
//     loadWeb3: () => dispatch(loadWeb3())
//   }
// }

export default connect(mapStateToProps)(App);
