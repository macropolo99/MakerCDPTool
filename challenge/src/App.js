// CDPTool.js
import './App.css';
import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { Pane, Heading, TextInput, Spinner, Select, Table } from 'evergreen-ui';
import { stringToBytes } from '@defisaver/tokens/esm/utils';
import { debounce } from "lodash";
import {Buffer} from 'buffer';
import { erc20AbiVaultInfo, erc20AbiMCDVault } from './contracts';

window.Buffer = window.Buffer || require("buffer").Buffer;

let erc20ContractVaultInfo;
let erc20ContractMCDVault;
let isInitialized = false;

// Initialize the contracts and web3 provider
export const init = async () => {
  let provider = "https://mainnet.infura.io/v3/<Infura API token>"; //infura API token
  let web3Provider = new Web3.providers.HttpProvider(provider);
  const web3 = new Web3(web3Provider);
  
	erc20ContractVaultInfo = new web3.eth.Contract(
		erc20AbiVaultInfo,
		//makerdao VaultInfo contract address mainnet
		'0x68C61AF097b834c68eA6EA5e46aF6c04E8945B2d'
	);
	erc20ContractMCDVault = new web3.eth.Contract(
		erc20AbiMCDVault,
		//makerdao MCDVault contract address mainnet
		'0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B'
	);
	isInitialized = true;
};

const CDPTool = () => {
  const [collateralType, setCollateralType] = useState('ETH-A');
  const [roughCdpId, setRoughCdpId] = useState('');
  const [cdpList, setCdpList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTable, setSearchTable] = useState(false);
  const [completedResults, setCompletedResults] = useState([]);
  const [abortController, setAbortController] = useState(new AbortController());
  const [selectedCdp, setSelectedCdp] = useState(null);

	//collateral types
  const collateralTypes = { "ETH-A": "ETH-A", "WBTC-A": "WBTC-A", "USDC-A": "USDC-A" };
  //find closest elements to the index
  const find_closest_elements = async (index, condition, n, signal) => {
    let right_search = true;
    let left_pointer = index - 1;
    let right_pointer = index + 1;
    const closest_elements = [];

    const updateCompletedResults = (id) => {
      setCompletedResults((prevResults) => [...prevResults, { id }]);
    };
    
    const indexCdp = await fetchCdp(index, signal)
    if (indexCdp && condition(indexCdp)) {
      closest_elements.push(indexCdp);
      updateCompletedResults(indexCdp.id);
    }

    while (closest_elements.length < n) {
      if (right_search === true) {
        if (left_pointer > 0 && ((Math.abs(index - left_pointer) < Math.abs(index - right_pointer)))) {
          const leftCdp = await fetchCdp(left_pointer, signal)
          if (leftCdp && condition(leftCdp)) {
            closest_elements.push(leftCdp);
            updateCompletedResults(leftCdp.id);
          }
          left_pointer -= 1;
        } else {
          const rightCdp = await fetchCdp(right_pointer, signal)
          if (rightCdp) {
            if(!condition(rightCdp)){
              right_search = false;
            } else {
              closest_elements.push(rightCdp);
              updateCompletedResults(rightCdp.id);
            }
          }
          right_pointer += 1;
        }
      } else if (left_pointer > 0){
        const leftCdp = await fetchCdp(left_pointer, signal)
        if (leftCdp && condition(leftCdp)) {
          closest_elements.push(leftCdp);
          updateCompletedResults(leftCdp.id);
        }
        left_pointer -= 1;
      }

      if (signal.aborted) {
        console.log('Search aborted');
        break;
      }
    }
    return closest_elements;
  };

  const fetchCdp = async (cdpId, signal) => {
    if (!isInitialized) {
        await init();
    }
    try {
      const collateralTypeBytes = stringToBytes(collateralType);
      // Check if the signal is aborted before proceeding with the fetch
      if (signal.aborted) {
        console.log('Fetch aborted');
        return null;
      }
      const cdpData = await erc20ContractVaultInfo.methods.getCdpInfo(cdpId).call().then((outputs) => {
        return {
          id: cdpId, 
          urn: outputs.urn, 
          owner: outputs.owner, 
          userAddr: outputs.userAddr, 
          ilk: outputs.ilk, 
          collateral: outputs.collateral, 
          debt: outputs.debt
        }
      });
      // Check if the signal is aborted after the fetch
      if (signal.aborted) {
        console.log('Fetch aborted after completion');
        return null;
      }
      if (cdpData.ilk === collateralTypeBytes || cdpData.owner == '0x0000000000000000000000000000000000000000') {
        return cdpData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching CDP data:', error);
      return null;
    }
  };

  const fetchData = async () => {
    try {
      setCdpList([]); // Clear list when starting a new search
      setLoading(true); // Show the loading spinner
      setSearchTable(true); // Show the search table
      // Abort the ongoing operation before starting a new one
      abortController.abort();
      // Create a new abort controller for the current request
      const controller = new AbortController();
      setAbortController(controller);
      const cdpId = parseInt(roughCdpId, 10);
      // Use find_closest_elements function to filter potential CDPs
      const closestElements = await find_closest_elements(
        cdpId, // Current index
        (cdp) => cdp.owner != '0x0000000000000000000000000000000000000000', // Condition to filter CDPs
        20, // Number of closest elements to find
        controller.signal // Abort signal
      );
      // const validClosestElements = closestElements.filter((cdp) => cdp !== null);
      // setCdpList(validClosestElements);
      setCdpList(closestElements)
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false); // Hide the loading spinner
    }
  };

  // Search list for a CDP by ID
  const searchById = (id) => {
    const result = cdpList.find((item) => item.id == id);
    return result || null;
  };

  // Fetch rate for the selected collateral type
  const fetchRate = async () => {
    if (!isInitialized) {
        await init();
    }
    try {
      const collateralTypeBytes = stringToBytes(collateralType);
      const cdpRate = await erc20ContractMCDVault.methods.ilks(collateralTypeBytes).call().then((outputs) => {
        return {
          art: outputs.Art, 
          rate: outputs.rate, 
          spot: outputs.spot, 
          line: outputs.line, 
          dust: outputs.dust
        }
      });
      if (cdpRate.rate) {
        return cdpRate;
      }
      return null;
    } catch (error) {
      console.error('Error fetching CDP data:', error);
      return null;
    }
  };

  // Calculate debt with interest
  const calculateDebtWithInterest = (debt, rate) => {
    const debtWithInterest = debt * rate;
    const exponent = BigInt((10 ** 43)); // 10^45 - 2 decimals
    const debtWithInterestNormalized = Number(debtWithInterest / exponent) / 100; // 2 decimals
    return debtWithInterestNormalized;
  };

  // Handle CDP selection
  const handleSelect = async (id) => {
    // Prevent selecting a CDP while loading
    if(loading === true) {
      return;
    }
    setCompletedResults([]); // Clear the list when selecting a CDP
    const cdpData = searchById(id)
    // Fetch rate for the selected collateral type
    const rate = await fetchRate().then((outputs) => outputs.rate);
    // Calculate debt with interest
    const debtWithInterest = calculateDebtWithInterest(cdpData.debt, rate);
   
    const exponent = BigInt((10 ** 16)); // 10^18 - 2 decimals
    const collateralNormalized = Number(cdpData.collateral / exponent) / 100;
    const collateral = `${String(collateralNormalized)} ${collateralType}`
    const debt = `${String(debtWithInterest)} ${"DAI"}` //hardcoded DAI for now

    // Set selected CDP
    setSelectedCdp({
      ID: cdpData.id,
      Owner: cdpData.userAddr,
      Collateral: collateral,
      Debt: debt,
    });
    // Hide the search table
    setSearchTable(false);
  };

  // Debounce the fetchData function to avoid making too many requests
  const debouncedFetchData = useCallback(
    debounce(async () => {
      setCompletedResults([]); // Clear the list at the start of a new search
      setSelectedCdp(null); // Clear selectedCdp when starting a new search
      await fetchData(roughCdpId.trim());
    }, 3000),
    [roughCdpId, collateralType]
  );

  // Fetch data when the input changes
  useEffect(() => {
    // Trigger the fetch data after 3 seconds of no input changes
    if (roughCdpId.trim() !== '') {
      debouncedFetchData();
    }
    // Cleanup function to cancel the debounced function
    return () => {
      debouncedFetchData.cancel();
      abortController.abort();
    };
  }, [roughCdpId, collateralType, debouncedFetchData]);
 
  return (
    <Pane background="green100" padding={16} height="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
      {/* Upper Pane with Input and Select */}
      <Pane className="headingContainer" width="40%" borderRadius={4} position="fixed" top="15%">
        <Heading size={800} padding={8}>MakerDao CDP Tool</Heading>
        {/* Search Box */}
        <Pane className="searchBoxContainer" elevation={4} background="green100">
          <Pane padding={16} borderRadius={4} >
            <Select
              title="Collateral Type"
              value={collateralType}
              placeholder="Select Collateral Type"
              onChange={(e) => setCollateralType(e.target.value)}
            >
              {Object.keys(collateralTypes).map((type) => (
                <option key={type} value={type}>
                  {collateralTypes[type]}
                </option>
              ))}
            </Select>
            <TextInput
              type="number"
              placeholder="Search by ID..."
              value={roughCdpId}
              onChange={(e) => setRoughCdpId(e.target.value)}
            />
          </Pane>
        </Pane>
      </Pane>
      {/* Container for Loading and Search Table */}
      <Pane className="searchTableContainer">
        {/* Search Table */}
        {selectedCdp === null && searchTable && (
          <Pane className="paneContainer" elevation={4} overflowY="auto" height={400} marginTop={8}>
            <Heading size={500} marginBottom={16}>
              {loading? <Spinner size={16}/> : <div>20 Closest CDPs by ID</div>}
            </Heading>
            <Table>
              <Table.Head>
                <Table.TextHeaderCell textAlign="center" paddingRight={0}>ID</Table.TextHeaderCell>
              </Table.Head>
              <Table.Body>
                {completedResults.map(({ id }) => (
                  <Table.Row key={id} isSelectable onSelect={() => handleSelect(id)}>
                    <Table.TextCell textAlign="center">{id}</Table.TextCell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </Pane>
        )}
      </Pane>
      {/* Selected CDP Details */}
      {selectedCdp && (
        <Pane className="cdpDetailsContainer" elevation={4} marginTop={8}>
          <Heading size={500} marginBottom={8}>
          CDP #{selectedCdp.ID}
          </Heading>
          <Table>
            <Table.Body>
              {Object.entries(selectedCdp).map(([key, value]) => (
                <Table.Row key={key}> 
                  <Table.TextCell flexBasis={120} flexShrink={0} flexGrow={0}>{key}</Table.TextCell>
                  <Table.TextCell textAlign="center">{String(value)}</Table.TextCell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Pane>
      )}
    </Pane>
  );  
};

export default CDPTool;

