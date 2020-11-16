#!/bin/bash
VERSION_COMMON_ALL=0.16.0
VERSION_ENGINE_SERVER=0.16.0

yarn unlink @dendronhq/common-all
yarn unlink @dendronhq/engine-server
yarn add --force  @dendronhq/common-all
yarn add --force  @dendronhq/engine-server
yarn add --force @dendronhq/mume@$VERSION_COMMON_ALL
yarn add --force @dendronhq/engine-server@$VERSION_ENGINE_SERVER