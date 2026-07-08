<template>
  <router-view />
</template>

<style>
/* ===== Global Reset & Base ===== */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 16px;
  line-height: 1.7;
  color: #2C3E50;
}

#app {
  min-height: 100vh;
}

/* ===== Element Plus overrides for elderly accessibility ===== */

/* Larger, warmer card headers */
.el-card__header {
  font-size: 16px;
  font-weight: 600;
  padding: 16px 20px;
  border-bottom-color: #EDE8E0;
}

.el-card__body {
  padding: 20px;
}

/* Larger buttons with clear labels */
.el-button {
  font-size: 15px;
  min-height: 40px;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 500;
}

.el-button--small {
  font-size: 13px;
  min-height: 32px;
  padding: 6px 14px;
}

.el-button--large {
  font-size: 17px;
  min-height: 48px;
  padding: 12px 28px;
}

/* Larger input fields */
.el-input__inner {
  font-size: 15px;
  height: 42px;
  line-height: 42px;
}

.el-input__inner::placeholder {
  color: #B0BEC5;
}

/* Clearer table text */
.el-table {
  font-size: 15px;
}

.el-table th {
  font-size: 14px;
  color: #5D6D7E;
  font-weight: 600;
}

.el-table td {
  font-size: 15px;
}

/* Form labels */
.el-form-item__label {
  font-size: 15px;
  font-weight: 600;
  color: #3D5060;
}

/* Tags */
.el-tag {
  font-size: 13px;
  border-radius: 6px;
}

.el-tag--large {
  font-size: 15px;
  padding: 6px 14px;
}

/* Pagination */
.el-pagination {
  font-size: 15px;
}

/* Dialog titles */
.el-dialog__title {
  font-size: 18px;
  font-weight: 700;
}

/* Descriptions */
.el-descriptions__label {
  font-size: 14px;
  font-weight: 600;
}

.el-descriptions__content {
  font-size: 15px;
}

/* Steps */
.el-step__title {
  font-size: 15px;
}

.el-step__description {
  font-size: 13px;
}

/* Tabs */
.el-tabs__item {
  font-size: 15px;
}

/* Popup menus */
.el-menu--popup .el-menu-item {
  font-size: 14px;
}

/* Alerts */
.el-alert__title {
  font-size: 15px;
}

/* Empty state text */
.el-empty__description p {
  font-size: 15px;
}

/* Collapse headers */
.el-collapse-item__header {
  font-size: 15px;
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #C8C0B8;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #A09890;
}

/* ===== Focus styles for keyboard navigation ===== */
.el-input__wrapper:focus-within {
  box-shadow: 0 0 0 3px rgba(91,139,160,0.15) !important;
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 2px solid #5B8BA0;
  outline-offset: 2px;
}

/* ===== Smooth transitions ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
