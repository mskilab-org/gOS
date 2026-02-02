import styled from "styled-components";

const Wrapper = styled.div`
  width: 100%;
  position: relative;

  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.8);
    z-index: 10;
  }

  .coverage-container {
    width: 100%;
    position: relative;
  }

  .pileup-container {
    width: 100%;
  }
`;

export default Wrapper;
