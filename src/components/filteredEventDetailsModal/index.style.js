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

  .filtered-event-review-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 0 -8px 4px;
    flex-shrink: 0;
  }

  .filtered-event-review-navigation .ant-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 1 auto;
    min-width: 0;
    max-width: calc(50% - 8px);
    height: 32px;
    padding: 4px 8px;
    border-radius: 6px;
    box-shadow: none;
    font-size: 13px;
    text-align: left;
  }

  .filtered-event-review-navigation .ant-btn:not(:disabled) {
    color: #595959;
  }

  .filtered-event-review-navigation .ant-btn:not(:disabled):hover {
    color: #1677ff;
    background: #f5f7fa;
  }

  .filtered-event-review-navigation .ant-btn:focus-visible {
    outline: 2px solid #1677ff;
    outline-offset: 2px;
  }

  .filtered-event-review-navigation .anticon {
    flex-shrink: 0;
    font-size: 10px;
  }

  .filtered-event-review-direction {
    flex-shrink: 0;
    font-weight: 500;
  }

  .filtered-event-review-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.85;
  }

  @media (max-width: 600px) {
    .filtered-event-review-navigation { gap: 8px; }
    .filtered-event-review-navigation .ant-btn {
      gap: 4px;
      max-width: calc(50% - 4px);
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
