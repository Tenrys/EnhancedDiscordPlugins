const Plugin = require("../plugin");
const { React } = EDApi;

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

        const getChannel = findModule("getChannel").getChannel;

        const request = window.require("request");

        const _messages = {};

        monkeyPatch(findModule("Message").Message.prototype, "render", function(data) {
            if (data.thisObject.props.embeddedMessage) return data.callOriginalMethod();

            const render = data.callOriginalMethod();

            const isCompact = /Compact/.test(render.props.className);
            const content = isCompact ? render : render.props.children[1];
            if (content) {
                if (!content.props.children) content.props.children = [];
                const messageEl = isCompact ? content.props.children[1] : content.props.children[0];
                if (messageEl.props.message && Array.isArray(messageEl.props.message.contentParsed)) {
                    const parsed = messageEl.props.message.contentParsed;
                    for (const item of parsed) {
                        if (typeof item !== "string" && item.props.href) {
                            const [_, channelId, messageId] = item.props.href.match(/https?:\/\/discordapp.com\/channels\/\d*\/(\d*)\/(\d*)\/?/) || [];
                            if (channelId && messageId) {
                                const channel = getChannel(channelId);
                                if (!_messages[messageId])
                                    request(
                                        `https://discordapp.com/api/v6/channels/${channelId}/messages?limit=1&around=${messageId}`,
                                        {
                                            headers: { Authorization: ED.localStorage.token.match(/"(.*)"/)[1] },
                                        },
                                        (err, res, body) => {
                                            const message = JSON.parse(body)[0];
                                            _messages[message.id] = message;
                                        }
                                    );
                                else
                                    content.props.children.push(
                                        React.createElement("div", { className: "embedded-message" }, [
                                            React.createElement(findModule("Message").Message, {
                                                message: _messages[messageId],
                                                channel,
                                                isHeader: true,
                                                disableJumpFlash: true,
                                                embeddedMessage: true,
                                                renderAccessories: data.thisObject.props.renderAccessories,
                                                renderPopoutUser: data.thisObject.props.renderPopoutUser,
                                                onContextMenuMessage: () => {},
                                                onContextMenuUser: data.thisObject.props.onContextMenuUser,
                                                onConfirmDelete: data.thisObject.props.onConfirmDelete,
                                                onClickUsername: data.thisObject.props.onClickUsername,
                                                onResize: data.thisObject.props.onResize,
                                            }),
                                        ])
                                    );
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
