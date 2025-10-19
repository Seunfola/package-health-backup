"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const user_profile_model_1 = require("./user-profile.model");
const user_profile_controller_1 = require("./user-profile.controller");
const user_profile_service_1 = require("./user-profile.service");
const axios_1 = require("@nestjs/axios");
let UserProfileModule = class UserProfileModule {
};
exports.UserProfileModule = UserProfileModule;
exports.UserProfileModule = UserProfileModule = __decorate([
    (0, common_1.Module)({
        imports: [
            axios_1.HttpModule,
            mongoose_1.MongooseModule.forFeature([
                { name: user_profile_model_1.UserProfile.name, schema: user_profile_model_1.UserProfileSchema },
            ]),
        ],
        controllers: [user_profile_controller_1.UserProfileController],
        providers: [user_profile_service_1.UserProfileService],
    })
], UserProfileModule);
//# sourceMappingURL=user-profile.module.js.map