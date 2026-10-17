// CosmosWhisper · ScriptWidget
// Chart image is bundled locally. The three hands use WidgetKit's clock-hand animation.
$render(
  <vstack frame="max,center" background="#030817">
    <zstack>
      <image name="chart" mode="fit" frame="max" />

      <vstack animation="clockHour">
        <rect frame="2.4,27" color="#f4e8c6" corner="1.2" />
        <rect frame="2.4,27" color="clear" />
      </vstack>

      <vstack animation="clockMinute">
        <rect frame="1.7,41" color="#fff4dd" corner="0.85" />
        <rect frame="1.7,41" color="clear" />
      </vstack>

      <vstack animation="clockSecond">
        <rect frame="0.9,52" color="#ff4b50" corner="0.45" />
        <rect frame="0.9,52" color="clear" />
      </vstack>

      <circle frame="6,6" color="#f5d68c" />
    </zstack>
  </vstack>
);
