const Plugin = require("../plugin");
const {
    React,
    React: { createElement: e },
} = EDApi;

/* Current issues:
    - Channel history for fetched message jumps around (HOW DO I FIX THIS)
*/

module.exports = new Plugin({
    name: "Quotes",
    author: "Tenrys#1999",
    description: "Preview quotes as embeds",
    preload: false,

    load: function() {
        EDApi.injectCSS(
            "quote",
            `
            .embedded-message {
                margin: 0.5rem 0.5rem 0 0.5rem;
                padding: 0.5rem 0;
                background: rgba(0, 0, 0, 0.125);
                border-radius: 4px;
            }

            .embedded-message div[class*="avatar-"] {
                margin: 0px 10px 10px;
            }

            .embedded-message div[class*="contentCozy-"] {
                margin-left: 60px;
            }
        `
        );

        const [getChannel, getMessage, fetchMessages] = [
            findModule("getChannel").getChannel,
            findModule("getMessage").getMessage,
            findModule("fetchMessages").fetchMessages,
        ];

        const toReRender = {};
        findModule("subscribe").subscribe("LOAD_MESSAGES_SUCCESS", data => {
            for (const message of data.messages) {
                const component = toReRender[message.id];
                if (component) {
                    component.forceUpdate();
                    delete toReRender[message.id];
                }
            }
        });

        /* None of this seems to be doing anything */
        monkeyPatch(findModule("dispatch"), "dispatch", data => {
            if (
                data.methodArguments[0].type == "LOAD_MESSAGES_SUCCESS" &&
                typeof data.methodArguments[0].jump == "object" &&
                data.methodArguments[0].jump.jump == false
            ) {
                data.methodArguments[0].jump = undefined;
            }
            return data.callOriginalMethod();
        });
        monkeyPatch(findModule("maybeDispatch"), "maybeDispatch", data => {
            if (
                data.methodArguments[0].type == "LOAD_MESSAGES" &&
                typeof data.methodArguments[0].jump == "object" &&
                data.methodArguments[0].jump.jump == false
            ) {
                data.methodArguments[0].jump = undefined;
            }
            return data.callOriginalMethod();
        });

        monkeyPatch(findModule("Message").Message.prototype, "render", function(data) {
            const render = data.callOriginalMethod();

            const isCompact = /Compact/.test(render.props.className);
            const content = isCompact ? render : render.props.children[1];
            if (content) {
                if (!content.props.children) content.props.children = [];
                const messageEl = isCompact ? content.props.children[1] : content.props.children[0];
                if (messageEl.props.message && messageEl.props.message.contentParsed) {
                    const parsed = messageEl.props.message.contentParsed;
                    for (const item of parsed) {
                        if (typeof item !== "string" && item.props.href) {
                            const [_, channelId, messageId] = item.props.href.match(/https?:\/\/discordapp.com\/channels\/\d*\/(\d*)\/(\d*)\/?/) || [];
                            if (channelId && messageId) {
                                const [channel, message] = [getChannel(channelId), getMessage(channelId, messageId)];
                                if (message) {
                                    /* This doesn't work, fuck cloned elements
                                    content.props.children.push(
                                        e(findModule("Message").Message, {
                                            message,
                                            channel,
                                            isHeader: true,
                                            disableJumpFlash: true,
                                            className: "embedded-message",
                                        })
                                    );
                                    */
                                } else if (channel) {
                                    fetchMessages(channelId, null, null, 1, { messageId, jump: false });
                                    toReRender[messageId] = data.thisObject;
                                }
                            }
                        }
                    }
                }
            }

            return render;
        });
    },
    unload: function() {},
});
