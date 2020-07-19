#!/bin/bash

yarn version --patch
vsce package
vsce publish