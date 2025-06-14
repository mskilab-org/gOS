import React, { Component } from "react";
import { Resizable } from "react-resizable";
import * as d3 from "d3";



class ResizableContainer extends Component {
    constructor(props) {
        super(props);
        this.container = React.createRef();
        this.state = {
            parentWidth: 0,
            width: 0,
            height: props.defaultHeight
        };
    }

    componentDidMount() {
        this.updateWidth();
        window.addEventListener("resize", this.updateWidth);
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.updateWidth);
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.parentWidth !== this.state.parentWidth) {
            this.updateWidth();
        }
    }

    updateWidth = () => {
        if (this.container.current) {
            this.setState({
                parentWidth: this.container.current.getBoundingClientRect().width,
            });
        }
    };

    handleResize = (event, { size }) => {
        const { defaultHeight, maxHeight } = this.props;
        this.setState({
            width: size.width,
            height: d3.min([
                d3.max([size.height, defaultHeight]),
                maxHeight,
            ]),
        });
    };

    render() {
        const { className = "", gap, padding = 0, children } = this.props;
        const { parentWidth, height } = this.state;
        let containerWidth = parentWidth || this.container.current?.getBoundingClientRect()?.width || 0;

        return (
            <div ref={this.container}>
                {containerWidth > 0 && (
                    <Resizable
                        className={className}
                        height={height}
                        width={containerWidth - gap}
                        onResize={this.handleResize}
                        resizeHandles={["sw", "se", "s"]}
                        draggableOpts={{ grid: [25, 25] }}
                    >
                        <div
                            className="ant-wrapper"
                            style={{
                                width: `${containerWidth - gap}px`,
                                height: `${height}px`,
                            }}
                        >
                            {children({
                                width: containerWidth - gap - 2 * padding,
                                height,
                            })}
                        </div>
                    </Resizable>
                )}
            </div>
        );
    }
}

export default ResizableContainer;
