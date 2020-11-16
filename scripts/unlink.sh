#!/bin/bash
VERSION_COMMON_ALL=0.16.0
VERSION_ENGINE_SERVER=0.16.0

yarn unlink @dendronhq/common-all
yarn unlink @dendronhq/engine-server
yarn add --force  @dendronhq/common-all@$VERSION_ENGINE_SERVER
yarn add --force  @dendronhq/engine-server@$VERSION_COMMON_ALL