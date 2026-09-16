'use client';

import { Box } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const count = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const plain = (value) => count.format(Number(value || 0));

/**
 * One measure across a handful of named rows.
 *
 * Horizontal because the names are words, not dates: a vertical bar chart would tilt "Course
 * Categories" onto its side and make the labels the hardest part of the figure to read. One
 * series, one hue — the rows are not competing categories, so a colour per row would encode rank,
 * which is exactly what colour must not do. The value sits at the end of each bar, so there is no
 * axis to read underneath, and hovering a bar names it.
 *
 * It lives in its own module because it is the only thing on an overview that needs recharts, and
 * recharts is a third of such a page's JavaScript — every page that draws one loads it lazily.
 * Institute and the small-business services all draw the same figure, so they share this one.
 */
export default function HorizontalBars({ data, palette, height, formatValue = plain }) {
  return (
    <Box sx={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid horizontal={false} stroke={palette.grid} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: palette.axis, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: palette.grid, fillOpacity: 0.35 }}
            formatter={(value, _name, item) => [formatValue(value), item?.payload?.label]}
            labelFormatter={() => ''}
            contentStyle={{ borderRadius: 10, border: `1px solid ${palette.grid}`, background: palette.surface, fontSize: 12 }}
          />
          <Bar dataKey="value" fill={palette.series[0]} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="right"
              formatter={formatValue}
              style={{ fill: palette.axis, fontSize: 12, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
