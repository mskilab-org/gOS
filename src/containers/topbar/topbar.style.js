import styled from "styled-components";

const TopbarWrapper = styled.div`
  .ant-pro-top-menu {
    position: sticky;
    top: 0px;
    padding: 0px;
    height: 48px;
    line-height: 48px;
    width: 100%;
    z-index: 19;
    background-color: #fff;
    .ant-pro-top-nav-header {
      position: relative;
      width: 100%;
      height: 100%;
      background-color: #fff;
      box-shadow: 0 1px 4px 0 rgb(0 21 41 / 12%);
      transition: background 0.3s, width 0.2s;
      z-index: 1000;
      .ant-pro-top-nav-header-main {
        display: flex;
        height: 100%;
        padding-left: 16px;
        padding-right: 16px;
        .ant-pro-top-nav-header-main-left {
          display: flex;
          min-width: 192px;
          .ant-pro-top-nav-header-logo {
            position: relative;
            min-width: 165px;
            height: 100%;
            overflow: hidden;
            cursor: pointer;
            img {
              display: inline-block;
              height: 32px;
              vertical-align: middle;
            }
            h1 {
              color: rgba(0, 0, 0, 0.85);
              display: inline-block;
              margin: 0 0 0 12px;
              font-weight: 400;
              font-size: 16px;
              vertical-align: top;
            }
          }
          .reports-select {
            min-width: 300px;
          }
          .datasets-select {
            min-width: 200px;
          }
        }
        .ant-pro-top-nav-header-menu {
          min-width: 0px;
          flex: 1 1 0%;
          .ant-menu.ant-menu-horizontal {
            height: 100%;
            border: none;
            background: 0 0;
            line-height: inherit;
          }
        }
        .ant-pro-top-nav-header-main-right {
          min-width: 32px;
          .ant-pro-top-nav-header-main-right-container {
            .ant-pro-loader-container {
              font-size: 16px;
            }
            .ant-pro-option-container {
              margin-top: 3px;
              padding: 0 12px;
              color: rgba(0, 0, 0, 0.75);
              font-size: 16px;
              cursor: pointer;
            }
          }
        }
      }
    }
  }
`;

export default TopbarWrapper;
