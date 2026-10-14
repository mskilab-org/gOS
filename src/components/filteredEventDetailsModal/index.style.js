import styled from "styled-components";

const Wrapper = styled.div`
  .ant-modal {
    top: 16px;
  }

  .ant-modal-content {
    padding: 0;
    display: flex;
    flex-direction: column;
    max-height: 100vh;
    padding: 20px 24px;
  }

  .ant-modal-body {
    padding: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .filtered-event-review-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 24px;
    flex-shrink: 0;
    margin-bottom: 4px;
  }

  .filtered-event-review-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 4px 0;
  }

  .filtered-event-review-control {
    display: inline-flex;
  }

  .filtered-event-review-controls .ant-checkbox-wrapper {
    margin-inline-start: 0;
    white-space: nowrap;
    font-size: 13px;
  }

  .filtered-event-review-cache-error {
    margin-bottom: 6px;
    font-size: 12px;
    flex-shrink: 0;
  }

  .filtered-event-review-navigation {
    display: flex;
    flex: 1 1 300px;
    min-width: 0;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    margin-inline-start: auto;
  }

  .filtered-event-review-button {
    display: inline-flex;
    flex: 0 1 auto;
    min-width: 0;
    max-width: calc(50% - 8px);
  }

  .filtered-event-review-navigation .ant-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 1 auto;
    min-width: 0;
    width: 100%;
    height: 32px;
    padding: 4px 10px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
    background: #fafafa;
    box-shadow: none;
    font-size: 13px;
    text-align: left;
  }

  .filtered-event-review-navigation .ant-btn:not(:disabled) {
    color: #262626;
  }

  .filtered-event-review-navigation .ant-btn:not(:disabled):hover {
    color: #1677ff;
    border-color: #1677ff;
    background: #e6f4ff;
  }

  .filtered-event-review-navigation .ant-btn:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }

  .filtered-event-review-navigation .anticon {
    flex-shrink: 0;
    font-size: 10px;
  }

  .filtered-event-review-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    .filtered-event-review-navigation { gap: 8px; flex-basis: 100%; }
    .filtered-event-review-button { max-width: calc(50% - 4px); }
    .filtered-event-review-navigation .ant-btn {
      gap: 4px;
      font-size: 12px;
    }
  }

  .filtered-event-details-tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .filtered-event-details-tabs .ant-tabs-content-holder {
    flex: 1;
    overflow: auto;       /* allow scrolling */
    display: flex;
    flex-direction: column;
    min-height: 0;        /* allow children to shrink */
  }

  .filtered-event-details-tabs .ant-tabs-content {
    height: 100%;
  }

  .filtered-event-details-tabs .ant-tabs-tabpane {
    height: 100%;
    min-height: 0;        /* critical for flex children scrolling */
  }

  .filtered-event-details-tabs .ant-tabs-tabpane:not(.ant-tabs-tabpane-hidden) {
    display: flex;
    flex-direction: column;
  }

  .filtered-event-tab-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .filtered-event-details-modal-loading {
    min-height: 320px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

`;

export default Wrapper;
