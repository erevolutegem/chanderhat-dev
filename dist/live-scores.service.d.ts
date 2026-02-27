import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';
import { EventsGateway } from './events.gateway';
export declare class LiveScoresService implements OnModuleInit, OnModuleDestroy {
    private readonly betsApiService;
    private readonly eventsGateway;
    private readonly logger;
    private timer;
    private isPolling;
    constructor(betsApiService: BetsApiService, eventsGateway: EventsGateway);
    onModuleInit(): void;
    onModuleDestroy(): void;
    private poll;
}
