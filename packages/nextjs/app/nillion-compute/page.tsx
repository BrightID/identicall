"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { prepareWriteContract, readContract, waitForTransaction, writeContract } from "@wagmi/core";
import type { NextPage } from "next";
import { useAccount, useContractRead } from "wagmi";
import { CopyString } from "~~/components/nillion/CopyString";
import { NillionOnboarding } from "~~/components/nillion/NillionOnboarding";
import { Address } from "~~/components/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { getUserKeyFromSnap } from "~~/utils/nillion/getUserKeyFromSnap";
import { nillionConfig } from "~~/utils/nillion/nillionConfig";
import { retrieveSecretInteger } from "~~/utils/nillion/retrieveSecretInteger";
import { storeProgram } from "~~/utils/nillion/storeProgram";
import { storeSecretsInteger } from "~~/utils/nillion/storeSecretsInteger";

interface StringObject {
  [key: string]: string | null;
}

const Home: NextPage = () => {
  const { data: deployedContractData } = useDeployedContractInfo("YourContract");
  const [programId, setProgramId] = useState<string | null>(null);
  const { data: currentRespondersCount } = useContractRead({
    address: deployedContractData?.address,
    functionName: "getPartiesAndSecretsCount",
    abi: deployedContractData?.abi,
    args: programId ? [programId] : undefined,
    watch: true,
  });
  const secretName = useMemo(() => `r${String(currentRespondersCount)}_response`, [currentRespondersCount]);
  const [partyIdToSecretIds, setPartyIdToSecretIds] = useState("");
  useEffect(() => {
    async function loadParties() {
      if (deployedContractData && currentRespondersCount && programId) {
        // const res = (await multicall({
        //   allowFailure: false,
        //   contracts: Array.from(Array(Number(currentRespondersCount)).keys()).map(i => ({
        //     address: deployedContractData.address,
        //     abi: deployedContractData.abi,
        //     functionName: "partiesAndSecrets",
        //     args: [programId, BigInt(i)],
        //   })),
        // })) as unknown as string[];
        const res = (await Promise.all(
          Array.from(Array(Number(currentRespondersCount)).keys()).map(i =>
            readContract({
              address: deployedContractData.address,
              abi: deployedContractData.abi,
              functionName: "partiesAndSecrets",
              args: [programId, BigInt(i)],
            }),
          ),
        )) as unknown as string[];
        console.log({ res });
        setPartyIdToSecretIds(res.join(" "));
      }
    }

    loadParties();
  }, [currentRespondersCount, deployedContractData, programId]);

  const { address: connectedAddress } = useAccount();
  const [connectedToSnap, setConnectedToSnap] = useState<boolean>(false);
  const [userKey, setUserKey] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nillion, setNillion] = useState<any>(null);
  const [nillionClient, setNillionClient] = useState<any>(null);

  const [programName] = useState<string>("identicall");
  const [computeResult, setComputeResult] = useState<{ [key: string]: bigint } | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [brightId, setBrightId] = useState("");
  const [secretValue, setSecretValue] = useState("");
  useEffect(() => {
    const encoder = new TextEncoder();
    const data = encoder.encode(brightId);
    crypto.subtle.digest("SHA-256", data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer)); // Convert buffer to byte array
      const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, "0")).join(""); // Convert bytes to hex string
      setSecretValue(BigInt("0x" + hashHex).toString());
    });
  }, [brightId]);

  const [storedSecretsNameToStoreId, setStoredSecretsNameToStoreId] = useState<StringObject>({
    my_int1: null,
    my_int2: null,
  });

  // connect to snap
  async function handleConnectToSnap() {
    const snapResponse = await getUserKeyFromSnap();
    setUserKey(snapResponse?.user_key || null);
    setConnectedToSnap(snapResponse?.connectedToSnap || false);
  }

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [myProgramIds, setMyProgramIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setMyProgramIds(JSON.parse(localStorage.getItem("myProgramIds") || "[]"));
    } catch (e) {}
  }, []);
  // store program in the Nillion network and set the resulting program id
  const handleStoreProgram = useCallback(async () => {
    setStateText("Storing program...");
    const newProgramId = await storeProgram(nillionClient, programName);
    const queryString = new URLSearchParams({
      ...Object.fromEntries(searchParams.entries()),
      p: encodeURIComponent(newProgramId),
      i: encodeURIComponent(identifier),
    });
    const newMyProjectIds = [...myProgramIds, newProgramId];
    localStorage.setItem("myProgramIds", JSON.stringify(newMyProjectIds));
    setMyProgramIds(newMyProjectIds);
    setStateText("");
    router.replace(`${pathname}?${queryString}`);
  }, [nillionClient, programName, searchParams, identifier, myProgramIds, router, pathname]);

  useEffect(() => {
    const pArg = searchParams.get("p");
    if (pArg) {
      setProgramId(decodeURIComponent(pArg));
    }
    const iArg = searchParams.get("i");
    if (iArg) {
      setIdentifier(decodeURIComponent(iArg));
    }
  }, [searchParams]);

  const isMyProgram = useMemo(() => Boolean(programId && myProgramIds.includes(programId)), [myProgramIds, programId]);

  async function handleRetrieveInt(secret_name: string, store_id: string | null) {
    if (store_id) {
      const value = await retrieveSecretInteger(nillionClient, store_id, secret_name);
      alert(`${secret_name} is ${value}`);
    }
  }

  // reset nillion values
  const resetNillion = () => {
    setConnectedToSnap(false);
    setUserKey(null);
    setUserId(null);
    setNillion(null);
    setNillionClient(null);
  };

  useEffect(() => {
    // when wallet is disconnected, reset nillion
    if (!connectedAddress) {
      resetNillion();
    }
  }, [connectedAddress]);

  // Initialize nillionClient for use on page
  useEffect(() => {
    console.log({ userKey });
    if (userKey) {
      const getNillionClientLibrary = async () => {
        const nillionClientUtil = await import("~~/utils/nillion/nillionClient");
        const libraries = await nillionClientUtil.getNillionClient(userKey);
        setNillion(libraries.nillion);
        setNillionClient(libraries.nillionClient);
        return libraries.nillionClient;
      };
      getNillionClientLibrary().then(nillionClient => {
        const user_id = nillionClient.user_id;
        setUserId(user_id);
      });
    }
  }, [userKey]);

  const [stateText, setStateText] = useState("");

  // handle form submit to store secrets with bindings
  async function handleSecretFormSubmit() {
    try {
      if (programId && deployedContractData && currentRespondersCount !== undefined) {
        setStateText("Storing secret...");
        const partyName = "Responder" + String(currentRespondersCount);

        const store_id = await storeSecretsInteger(
          nillion,
          nillionClient,
          [{ name: secretName, value: secretValue }],
          programId,
          partyName,
          [],
          [],
          [],
          [programId.split("/")[0]],
        );
        const partyIdToSecretId = `${nillionClient.party_id}:${store_id}`;
        const { request } = await prepareWriteContract({
          address: deployedContractData.address,
          abi: deployedContractData.abi,
          functionName: "addPartyAndSecret",
          args: [programId, partyIdToSecretId],
        });
        setStateText("Awaiting user confirmation...");
        const { hash } = await writeContract(request);
        setStateText("Sending transaction...");
        await waitForTransaction({
          hash,
        });
        console.log("Secret stored at store_id:", store_id);
        setStoredSecretsNameToStoreId(prevSecrets => ({
          ...prevSecrets,
          [secretName]: store_id,
        }));
      }
    } catch (e) {
      setStateText("");
    }
  }

  // compute on secrets
  async function handleCompute() {
    if (programId) {
      // await compute(
      //   nillion,
      //   nillionClient,
      //   Object.values(storedSecretsNameToStoreId),
      //   programId,
      //   "same_response_count_for_r4",
      // ).then(result => setComputeResult(result));
      try {
        // create program bindings with the program id
        const program_bindings = new nillion.ProgramBindings(programId);

        // add input and output party details (name and party id) to program bindings
        Array.from(Array(4).keys()).forEach(i => {
          const partyName = "Responder" + i;
          const party_id = nillionClient.party_id;
          program_bindings.add_input_party(partyName, party_id);
        });
        program_bindings.add_input_party("Responder4", nillionClient.party_id);
        program_bindings.add_output_party("Responder4", nillionClient.party_id);

        // create a compute time secrets object
        const compute_time_secrets = new nillion.Secrets();
        const newComputeTimeSecret = nillion.Secret.new_unsigned_integer(secretValue);
        compute_time_secrets.insert("r4_response", newComputeTimeSecret);

        // create a public variables object
        const public_variables = new nillion.PublicVariables();

        // compute
        const compute_result_uuid = await nillionClient.compute(
          nillionConfig.cluster_id,
          program_bindings,
          partyIdToSecretIds.split(" ").map(s => s.split(":")[1]),
          compute_time_secrets,
          public_variables,
        );
        setComputeResult(await nillionClient.compute_result(compute_result_uuid));
      } catch (error: any) {
        console.log("error", error);
        return "error";
      }
    }
  }

  const [verified, setVerified] = useState(false);

  return (
    <>
      <div className="flex items-center flex-col pt-10">
        <div className="px-5 flex flex-col">
          <h1 className="text-xl">
            <span className="block text-4xl font-bold text-center">Identicall</span>
            <span className="block text-xl font-bold text-center mt-2">Fight sybil attacks on social graphs</span>
            {!connectedAddress && <p>Connect your MetaMask Flask wallet</p>}
            {connectedAddress && connectedToSnap && !userKey && (
              <a target="_blank" href="https://nillion-snap-site.vercel.app/" rel="noopener noreferrer">
                <button className="btn btn-sm btn-primary mt-4">
                  No Nillion User Key - Generate and store user key here
                </button>
              </a>
            )}
          </h1>

          {connectedAddress && (
            <div className="flex justify-center items-center space-x-2">
              <p className="my-2 font-medium">Connected Wallet Address:</p>
              <Address address={connectedAddress} />
            </div>
          )}

          {connectedAddress && !connectedToSnap && (
            <button className="btn btn-sm btn-primary mt-4" onClick={handleConnectToSnap}>
              Connect to Snap with your Nillion User Key
            </button>
          )}

          {connectedToSnap && (
            <div>
              {userKey && (
                <div>
                  <div className="flex justify-center items-center space-x-2">
                    <p className="my-2 font-medium">
                      🤫 Nillion User Key from{" "}
                      <a target="_blank" href="https://nillion-snap-site.vercel.app/" rel="noopener noreferrer">
                        MetaMask Flask
                      </a>
                      :
                    </p>

                    <CopyString str={userKey} />
                  </div>

                  {userId && (
                    <div className="flex justify-center items-center space-x-2">
                      <p className="my-2 font-medium">Connected as Nillion User ID:</p>
                      <CopyString str={userId} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
            {!connectedToSnap ? (
              <NillionOnboarding />
            ) : !verified ? (
              <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-[700px] rounded-3xl my-2">
                <h1 className="text-xl">Verify your Nillion user with BrightID</h1>
                <button className="btn btn-sm btn-primary mt-4" onClick={() => setVerified(true)}>
                  Verify
                </button>
              </div>
            ) : !programId ? (
              <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-[700px] rounded-3xl my-2">
                <h1 className="text-xl">Launch an investigation!</h1>
                <p className="text-left">
                  Press the button below to start an investigation and invite the others to see if you all know the same
                  BrightID of the person. Optionally, you can type an identifier of the person (e.g. Discord Id, phone
                  number, etc) to share
                </p>
                <div>
                  <label htmlFor="secret" className="block text-sm font-medium text-white">
                    Known Identifier of the Person (Optional)
                  </label>
                  <input
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                    className={`mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-black`}
                  />
                </div>
                {stateText ? (
                  stateText
                ) : (
                  <button className="btn btn-sm btn-primary mt-4" onClick={handleStoreProgram}>
                    Start
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center max-w-[700px] rounded-3xl my-2">
                  <h1 className="text-xl">Investigating person with identifier {identifier}</h1>✅ {programName} program
                  stored <br />
                  <CopyString str={programId} start={5} end={programName.length + 5} textBefore="Program Id: " />
                  <CopyString str={window.location.href} start={0} end={5} textBefore="Program Link: " />
                </div>
                <div className="flex flex-col bg-base-100 px-10 py-10 text-center items-center w-full rounded-3xl my-2 justify-between">
                  <h1 className="text-xl">
                    What is the BrightID that you know for the person with identifier {identifier}?
                  </h1>
                  <h3 className="text-l">
                    Current responses count:{" "}
                    {currentRespondersCount !== undefined ? String(currentRespondersCount) : "..."}
                  </h3>
                  <div className="pb-2">The BrightID you enter is hashed before being sent to the server</div>

                  <div className="flex flex-row w-full justify-between items-center mx-10">
                    <div className="flex-1 px-2">
                      {!!storedSecretsNameToStoreId[secretName] && userKey ? (
                        <div>Successfully submitted!</div>
                      ) : (
                        <div>
                          <div className="text-black">
                            <input
                              type="text"
                              id="secret"
                              placeholder="BrightID"
                              value={brightId}
                              onChange={e => setBrightId(e.target.value)}
                              required
                              disabled={!programId}
                              className={`mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                                !programId ? "cursor-not-allowed bg-gray-100" : "bg-white"
                              }`}
                            />
                          </div>
                          <div className="pt-2">
                            {stateText ? (
                              stateText
                            ) : isMyProgram ? (
                              <div>
                                <div className="text-left pb-2">[DEV Mode] party and secret ids:</div>
                                <textarea
                                  className="w-full bg-white text-black h-44 p-1"
                                  value={partyIdToSecretIds}
                                  onChange={e => setPartyIdToSecretIds(e.target.value)}
                                />
                                <button
                                  disabled={!programId}
                                  onClick={handleCompute}
                                  className={`mt-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                                    !programId ? "opacity-75 cursor-not-allowed bg-indigo-400" : "bg-indigo-600"
                                  }`}
                                >
                                  Compute
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={!programId}
                                onClick={handleSecretFormSubmit}
                                className={`mt-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                                  !programId ? "opacity-75 cursor-not-allowed bg-indigo-400" : "bg-indigo-600"
                                }`}
                              >
                                Submit
                              </button>
                            )}
                            {computeResult && (
                              <div>
                                <p>✅ Compute result</p>
                                <table>
                                  <th>
                                    <td>Party</td>
                                    <td>Match Rate</td>
                                  </th>
                                  {Array.from(Array(4).keys()).map(i => (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td>{Number(computeResult["same_response_count_for_r" + i]) * 20}%</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td>5 (You)</td>
                                    <td>{Number(computeResult["same_response_count_for_r4"]) * 20}%</td>
                                  </tr>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
