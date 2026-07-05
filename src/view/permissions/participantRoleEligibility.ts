import { GitCodeUser, PermissionRequirement } from '../../common/models';
import { roleCanByDefault } from './rolePermissionProfiles';

const reviewerRequirement: PermissionRequirement = {
	scope: 'pr',
	action: 'review',
	message: () => '',
};

const testerRequirement: PermissionRequirement = {
	scope: 'pr',
	action: 'test',
	message: () => '',
};

const assigneeRequirement: PermissionRequirement = {
	scope: 'pr',
	action: 'approve',
	message: () => '',
};

export interface PullRequestParticipantCandidates {
	reviewers: GitCodeUser[];
	testers: GitCodeUser[];
	assignees: GitCodeUser[];
}

export function buildPullRequestParticipantCandidates(
	members: readonly GitCodeUser[],
): PullRequestParticipantCandidates {
	return {
		reviewers: filterMembersByRolePermission(members, reviewerRequirement),
		testers: filterMembersByRolePermission(members, testerRequirement),
		assignees: filterMembersByRolePermission(members, assigneeRequirement),
	};
}

function filterMembersByRolePermission(
	members: readonly GitCodeUser[],
	requirement: PermissionRequirement,
): GitCodeUser[] {
	return members.filter((member) => member.login.trim().length > 0 && roleCanByDefault(member.role, requirement));
}
