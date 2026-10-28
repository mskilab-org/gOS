import { Component } from "react";
import { visualElementAnchor } from "../../helpers/visualElementLinks";
import { withTranslation } from "react-i18next";
import { connect } from "react-redux";
import Wrapper from "./index.style";
import FilteredEventsListPanel from "../../components/filteredEventsListPanel";

class FilteredEventsTab extends Component {
  render() {
    return (
      <Wrapper {...visualElementAnchor("events")}>
        <FilteredEventsListPanel />
      </Wrapper>
    );
  }
}
FilteredEventsTab.propTypes = {};
FilteredEventsTab.defaultProps = {};
const mapDispatchToProps = (dispatch) => ({});
const mapStateToProps = (state) => ({});
export default connect(
  mapStateToProps,
  mapDispatchToProps
)(withTranslation("common")(FilteredEventsTab));
