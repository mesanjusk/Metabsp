import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import { Contact, InstagramAccount, Message, WhatsAppAccount } from '@/lib/models';
import { resolveServiceAccess } from '@/lib/services/serviceAccess';
import { buildGrowthAgents, buildGrowthRecommendations } from '@/lib/services/growthIntelligence';

const LEAD_CATEGORY = /interest|qualified|hot|warm|follow.?up|followup|callback|reminder|quotation|quote|proposal|estimate/i;
const CUSTOMER_CATEGORY = /convert|won|customer|sale|confirmed/i;

function before(ms: number) {
  return new Date(Date.now() - ms);
}

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const authed = await requireAuth(req);
    const userId = authed.doc._id;

    const fifteenMinutesAgo = before(15 * 60 * 1000);
    const oneDayAgo = before(24 * 60 * 60 * 1000);
    const twoDaysAgo = before(2 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = before(7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = before(30 * 24 * 60 * 60 * 1000);

    const [
      access,
      newLeads7d,
      activeOpportunities,
      overdueFollowUps,
      unansweredRows,
      reactivationCandidates,
      whatsapp,
      instagram,
    ] = await Promise.all([
      resolveServiceAccess(authed),
      Contact.countDocuments({ userId, createdAt: { $gte: sevenDaysAgo } }),
      Contact.countDocuments({ userId, category: LEAD_CATEGORY }),
      Contact.countDocuments({ userId, category: LEAD_CATEGORY, updatedAt: { $lte: twoDaysAgo } }),
      Message.aggregate([
        {
          $match: {
            userId,
            $or: [
              { timestamp: { $gte: oneDayAgo } },
              { timestamp: null, createdAt: { $gte: oneDayAgo } },
            ],
          },
        },
        {
          $addFields: {
            activityAt: { $ifNull: ['$timestamp', '$createdAt'] },
            customerPhone: {
              $cond: [
                { $or: [{ $eq: ['$direction', 'incoming'] }, { $eq: ['$fromMe', false] }] },
                '$from',
                '$to',
              ],
            },
          },
        },
        { $sort: { activityAt: -1 } },
        {
          $group: {
            _id: '$customerPhone',
            latestDirection: { $first: '$direction' },
            latestFromMe: { $first: '$fromMe' },
            latestAt: { $first: '$activityAt' },
          },
        },
        {
          $match: {
            _id: { $nin: [null, ''] },
            latestAt: { $lte: fifteenMinutesAgo },
            $or: [{ latestDirection: 'incoming' }, { latestFromMe: false }],
          },
        },
        { $count: 'count' },
      ]),
      Contact.countDocuments({
        userId,
        category: CUSTOMER_CATEGORY,
        $or: [
          { lastSeen: { $lte: thirtyDaysAgo } },
          { lastSeen: null, updatedAt: { $lte: thirtyDaysAgo } },
        ],
      }),
      WhatsAppAccount.findOne({ userId, isActive: true }).select('status displayPhoneNumber verifiedName').lean(),
      InstagramAccount.findOne({ userId, isActive: true }).select('status username name').lean(),
    ]);

    const unansweredConversations = Number(unansweredRows?.[0]?.count || 0);

    const inputs = {
      activeOpportunities,
      overdueFollowUps,
      unansweredConversations,
      reactivationCandidates,
      whatsappConnected: whatsapp?.status === 'active',
      instagramConnected: instagram?.status === 'active',
      marketingEnabled: Boolean(access?.marketing?.enabled),
      // Google Business is a basic entitlement, but there is no provider/account
      // connection model yet. Entitlement must never be reported as a live channel.
      googleBusinessLive: false,
    };

    const recommendations = buildGrowthRecommendations(inputs);
    const agents = buildGrowthAgents(inputs);
    const urgentCount = recommendations.filter((item) => item.priority === 'urgent').length;
    const highCount = recommendations.filter((item) => item.priority === 'high').length;

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          newLeads7d,
          activeOpportunities,
          overdueFollowUps,
          unansweredConversations,
          reactivationCandidates,
          urgentCount,
          highCount,
        },
        agents,
        recommendations,
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to load growth insights');
  }
}
