from nada_dsl import *


def initialize_responders(nr_responders):
    responders = []
    for i in range(nr_responders):
        responders.append(Party(name="Responder" + str(i)))
    return responders


def inputs_initialization(nr_responders, responders):
    responses = []
    for r in range(nr_responders):
        responses.append(SecretUnsignedInteger(Input(name="r" + str(r) + "_response", party=responders[r])))
    return responses


def nada_main():
    # 0. Compiled-time constants
    nr_responders = 5

    # 1. Parties initialization
    responders = initialize_responders(nr_responders)
    outparty = responders[nr_responders - 1]

    # 2. Inputs initialization
    responses = inputs_initialization(nr_responders, responders)

    # 3. Computation
    # Count the responses
    same_response_counts = []
    for r in range(nr_responders):
        same_response_count_for_r = UnsignedInteger(0)
        for r2 in range(nr_responders):
            same_response_count_for_r += (responses[r] >= responses[r2]).if_else(
                (responses[r] <= responses[r2]).if_else(UnsignedInteger(1), UnsignedInteger(0)),
                UnsignedInteger(0)
            )
        same_response_counts.append(Output(same_response_count_for_r, "same_response_count_for_r" + str(r), outparty))
    return same_response_counts
