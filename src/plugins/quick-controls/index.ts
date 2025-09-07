/**
 * Quick Controls 插件入口
 * 提供跨平台的快速播放控制功能，支持 macOS Dock 菜单、Windows 托盘、Linux 托盘
 */

import { createPlugin } from '@/utils';
import { t } from '@/i18n';
import { onBackendLoad } from './backend';
import { renderer } from './renderer';

import type { QuickControlsConfig } from './types';

/**
 * 创建 Quick Controls 插件定义
 * 使用项目的 createPlugin 工厂函数创建标准插件结构
 */
export default createPlugin({

  name: () => t('plugins.quick-controls.name') || 'Quick Controls',
  description: () => t('plugins.quick-controls.description') || 'Dock/tray-click',

  restartNeeded: true,

  config: {
    enabled: true,                     
    showPlaybackControls: true,        
    showLikeButton: true,              
    showRepeatControl: true,
    showShuffleControl: true,          // 默认显示随机播放控制
  } as QuickControlsConfig,

  backend: onBackendLoad,
  renderer: renderer,
});

export type { QuickControlsConfig } from './types';
