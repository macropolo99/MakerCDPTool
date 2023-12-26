
export const erc20AbiVaultInfo = [
    {
        inputs:[
            {
                internalType:"address",
                name:"owner",
                type:"address"
            }
        ],
        name:"_getProxyOwner",
        outputs:[
            {
                internalType:"address",
                name:"userAddr",
                type:"address"
            }
        ],
        stateMutability:"view",
        type:"function"
    },
    {
        inputs:[
            {
                internalType:"uint256",
                name:"_cdpId",
                type:"uint256"
            }
        ],
        name:"getCdpInfo",
        outputs:[
            {
                internalType:"address",
                name:"urn",
                type:"address"
            },
            {
                internalType:"address",
                name:"owner",
                type:"address"
            },
            {
                internalType:"address",
                name:"userAddr",
                type:"address"
            },
            {
                internalType:"bytes32",
                name:"ilk",
                type:"bytes32"
            },
            {
                internalType:"uint256",
                name:"collateral",
                type:"uint256"
            },
            {
                internalType:"uint256",
                name:"debt",
                type:"uint256"
            }
        ],
        stateMutability:"view",
        type:"function"
    }
];

export const erc20AbiMCDVault = [
  {
    constant: true,
    inputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32"
      }
    ],
    name: "ilks",
    outputs: [
      {
        internalType: "uint256",
        name: "Art",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "rate",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "spot",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "line",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "dust",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  }      
];
