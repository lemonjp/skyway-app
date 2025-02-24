'use client';

import { SkyWayAuthToken, nowInSec, uuidV4 } from '@skyway-sdk/core';

interface GenerateTokenOptions {
  username: string;
  roomName: string;
}

export const generateSkyWayToken = ({ username, roomName }: GenerateTokenOptions): string => {
  // 環境変数の値をログ出力
  console.log('APP_ID:', process.env.NEXT_PUBLIC_SKYWAY_APP_ID);
  console.log('SECRET_KEY:', process.env.NEXT_PUBLIC_SKYWAY_SECRET_KEY);

  if (!process.env.NEXT_PUBLIC_SKYWAY_APP_ID || !process.env.NEXT_PUBLIC_SKYWAY_SECRET_KEY) {
    throw new Error('SkyWay credentials are not properly configured');
  }

  const token = new SkyWayAuthToken({
    jti: uuidV4(),
    iat: nowInSec(),
    exp: nowInSec() + 60 * 60 * 24,
    scope: {
      app: {
        id: process.env.NEXT_PUBLIC_SKYWAY_APP_ID,
        turn: true,
        actions: ['read'],
        channels: [{
          id: '*',
          name: roomName,
          actions: ['write'],
          members: [{
            id: '*',
            name: username,
            actions: ['write'],
            publication: {
              actions: ['write']
            },
            subscription: {
              actions: ['write']
            }
          }],
          sfuBots: [{
            actions: ['write'],
            forwardings: [{
              actions: ['write']
            }]
          }]
        }]
      }
    }
  });

  // シークレットキーでトークンをエンコード
  return token.encode(process.env.NEXT_PUBLIC_SKYWAY_SECRET_KEY!);
};
