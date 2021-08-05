#!/usr/bin/python3

from brownie import Token, accounts


def main():
    acct = accounts.load('deployer')
    return Token.deploy("MemeX", "MEMEX", 18, 1e21, {'from': accounts[0]})
    
