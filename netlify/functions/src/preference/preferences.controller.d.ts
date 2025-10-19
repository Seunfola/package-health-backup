import { UserPreferencesService } from './preferences.service';
import { UpdatePreferencesDto, PreferencesResponseDto } from './preferences.dto';
interface AuthenticatedRequest {
    user: {
        id: string;
    };
}
export declare class UserPreferencesController {
    private readonly preferencesService;
    constructor(preferencesService: UserPreferencesService);
    getDefaultPreferences(): PreferencesResponseDto;
    resetPreferences(req: AuthenticatedRequest): Promise<PreferencesResponseDto>;
    getPreferences(req: AuthenticatedRequest): Promise<PreferencesResponseDto>;
    updatePreferences(req: AuthenticatedRequest, updatePreferencesDto: UpdatePreferencesDto): Promise<PreferencesResponseDto>;
}
export {};
